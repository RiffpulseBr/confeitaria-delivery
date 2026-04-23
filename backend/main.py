import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from supabase import Client, create_client

from routers.pedidos import router as pedidos_router
from routers.producao import router as producao_router
from schemas import (
    EstoqueEntradaCreate,
    EstoqueProdutoCreate,
    EstoqueProdutoEntradaCreate,
    EstoqueProdutoMovimentoCreate,
    InsumoCreate,
    IfoodAckRequest,
    IfoodCloseStoreRequest,
    IfoodItemMappingCreate,
    IfoodOAuthToken,
    IfoodOpenStoreRequest,
    IfoodWebhookEvent,
    PedidoCreate,
    ProdutoCreate,
    ProdutoUpdate,
    ReceitaCreate,
)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
IFOOD_BASE_URL = os.getenv("IFOOD_BASE_URL", "https://merchant-api.ifood.com.br")
IFOOD_CLIENT_ID = os.getenv("IFOOD_CLIENT_ID")
IFOOD_CLIENT_SECRET = os.getenv("IFOOD_CLIENT_SECRET")
TOKEN_RENEWAL_MARGIN_SECONDS = 60

supabase_client: Optional[Client] = None

ifood_token_cache: dict[str, Any] = {
    "access_token": None,
    "refresh_token": None,
    "expires_at": None,
}

app = FastAPI(title="API Sistema Confeitaria")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pedidos_router)
app.include_router(producao_router)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_supabase_client() -> Client:
    global supabase_client

    if supabase_client is not None:
        return supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL e SUPABASE_SERVICE_KEY/SUPABASE_KEY precisam estar configurados no backend.",
        )

    supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase_client


def _raise_ifood_not_configured() -> None:
    if not IFOOD_CLIENT_ID or not IFOOD_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET precisam estar configurados no backend.",
        )


def _token_still_valid() -> bool:
    expires_at = ifood_token_cache.get("expires_at")
    access_token = ifood_token_cache.get("access_token")
    if not expires_at or not access_token:
        return False
    return datetime.now(timezone.utc) < expires_at - timedelta(seconds=TOKEN_RENEWAL_MARGIN_SECONDS)


def _cache_ifood_token(token: IfoodOAuthToken) -> str:
    ifood_token_cache["access_token"] = token.access_token
    ifood_token_cache["refresh_token"] = token.refresh_token
    ifood_token_cache["expires_at"] = datetime.now(timezone.utc) + timedelta(seconds=token.expires_in)
    return token.access_token


def _request_new_ifood_token(force_client_credentials: bool = False) -> str:
    _raise_ifood_not_configured()

    grant_type = "client_credentials"
    form_data = {
        "grantType": "client_credentials",
        "clientId": IFOOD_CLIENT_ID,
        "clientSecret": IFOOD_CLIENT_SECRET,
    }

    refresh_token = ifood_token_cache.get("refresh_token")
    if refresh_token and not force_client_credentials:
        grant_type = "refresh_token"
        form_data = {
            "grantType": "refresh_token",
            "clientId": IFOOD_CLIENT_ID,
            "clientSecret": IFOOD_CLIENT_SECRET,
            "refreshToken": refresh_token,
        }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{IFOOD_BASE_URL.rstrip('/')}/authentication/v1.0/oauth/token",
                headers={
                    "accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data=form_data,
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        if grant_type == "refresh_token":
            return _request_new_ifood_token(force_client_credentials=True)
        detail = exc.response.text or str(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Falha ao autenticar com iFood: {exc}") from exc

    token = IfoodOAuthToken(
        access_token=payload.get("accessToken") or payload.get("access_token"),
        expires_in=payload.get("expiresIn") or payload.get("expires_in") or 0,
        refresh_token=payload.get("refreshToken") or payload.get("refresh_token"),
        token_type=payload.get("tokenType") or payload.get("token_type") or "Bearer",
    )
    return _cache_ifood_token(token)


def _get_ifood_access_token(force_refresh: bool = False) -> str:
    if force_refresh or not _token_still_valid():
        return _request_new_ifood_token(force_client_credentials=force_refresh)
    return ifood_token_cache["access_token"]


def _ifood_headers(force_refresh: bool = False) -> dict[str, str]:
    access_token = _get_ifood_access_token(force_refresh=force_refresh)
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _ifood_request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    _raise_ifood_not_configured()
    url = f"{IFOOD_BASE_URL.rstrip('/')}/{path.lstrip('/')}"
    headers = kwargs.pop("headers", {})
    merged_headers = {**_ifood_headers(), **headers}
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.request(method, url, headers=merged_headers, **kwargs)
            response.raise_for_status()
            return response
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            try:
                retry_headers = {**_ifood_headers(force_refresh=True), **headers}
                with httpx.Client(timeout=30.0) as client:
                    retry_response = client.request(method, url, headers=retry_headers, **kwargs)
                    retry_response.raise_for_status()
                    return retry_response
            except httpx.HTTPStatusError as retry_exc:
                detail = retry_exc.response.text or str(retry_exc)
                raise HTTPException(status_code=retry_exc.response.status_code, detail=detail) from retry_exc
            except httpx.HTTPError as retry_exc:
                raise HTTPException(status_code=502, detail=f"Falha ao comunicar com iFood: {retry_exc}") from retry_exc
        detail = exc.response.text or str(exc)
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Falha ao comunicar com iFood: {exc}") from exc


def _safe_compare_signature(raw_body: bytes, received_signature: Optional[str]) -> None:
    if not IFOOD_CLIENT_SECRET:
        return

    if not received_signature:
        raise HTTPException(status_code=401, detail="Header X-IFood-Signature ausente.")

    expected_signature = hmac.new(
        IFOOD_CLIENT_SECRET.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, received_signature):
        raise HTTPException(status_code=401, detail="Assinatura do webhook iFood invalida.")


def _fetch_table_rows(table: str, filters: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    query = _get_supabase_client().table(table).select("*")
    for key, value in (filters or {}).items():
        query = query.eq(key, value)
    response = query.execute()
    return response.data or []


def _record_ifood_event(
    event: dict[str, Any],
    processing_status: str,
    error_message: Optional[str] = None,
    acknowledged_at: Optional[str] = None,
) -> None:
    payload = {
        "event_id": event.get("id"),
        "order_id": event.get("orderId"),
        "merchant_id": event.get("merchantId"),
        "event_code": event.get("code"),
        "event_full_code": event.get("fullCode"),
        "sales_channel": event.get("salesChannel"),
        "payload": event,
        "processing_status": processing_status,
        "error_message": error_message,
        "received_at": _utc_now_iso(),
        "acknowledged_at": acknowledged_at,
    }
    try:
        _get_supabase_client().table("ifood_event_logs").upsert(payload, on_conflict="event_id").execute()
    except Exception:
        pass


def _mark_acknowledged(event_ids: Iterable[str]) -> None:
    acknowledged_at = _utc_now_iso()
    for event_id in event_ids:
        try:
            _get_supabase_client().table("ifood_event_logs").update(
                {"acknowledged_at": acknowledged_at, "processing_status": "acknowledged"}
            ).eq("event_id", event_id).execute()
        except Exception:
            continue


def _extract_merchant_item_id(item: dict[str, Any]) -> Optional[str]:
    return item.get("merchantItemId") or item.get("merchant_item_id") or item.get("externalCode")


def _resolve_product_mapping(merchant_id: Optional[str], item: dict[str, Any]) -> Optional[dict[str, Any]]:
    merchant_item_id = _extract_merchant_item_id(item)
    if not merchant_item_id:
        return None

    try:
        query = _get_supabase_client().table("ifood_item_mappings").select("*").eq("merchant_item_id", merchant_item_id)
        if merchant_id:
            query = query.eq("merchant_id", merchant_id)
        response = query.limit(1).execute()
        mappings = response.data or []
        return mappings[0] if mappings else None
    except Exception:
        return None


def _build_ifood_local_items(order_details: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    merchant_id = (order_details.get("merchant") or {}).get("id")
    mapped_items: list[dict[str, Any]] = []
    unresolved_items: list[dict[str, Any]] = []

    for item in order_details.get("items", []):
        mapping = _resolve_product_mapping(merchant_id, item)
        merchant_item_id = _extract_merchant_item_id(item)
        if not mapping:
            unresolved_items.append(
                {
                    "nome": item.get("name"),
                    "merchant_item_id": merchant_item_id,
                    "unique_id": item.get("uniqueId"),
                }
            )
            continue

        mapped_items.append(
            {
                "produto_id": mapping["produto_id"],
                "quantidade": item.get("quantity", 0),
                "preco_unitario": item.get("unitPrice", 0),
            }
        )

    return mapped_items, unresolved_items


def _pedido_payload_from_ifood(order_details: dict[str, Any]) -> dict[str, Any]:
    total = (order_details.get("total") or {}).get("orderAmount") or 0
    merchant = order_details.get("merchant") or {}
    return {
        "origem": "iFood",
        "status": "pendente",
        "valor_total": total,
        "pedido_externo_id": order_details.get("id"),
        "merchant_id": merchant.get("id"),
        "canal_externo": "IFOOD",
        "referencia_externa": order_details.get("displayId"),
    }


def _create_local_order_with_fallback(order_payload: dict[str, Any]) -> str:
    try:
        response = _get_supabase_client().table("pedidos").insert(order_payload).execute()
        return response.data[0]["id"]
    except Exception:
        fallback_payload = {
            "origem": order_payload["origem"],
            "status": order_payload["status"],
            "valor_total": order_payload["valor_total"],
        }
        response = _get_supabase_client().table("pedidos").insert(fallback_payload).execute()
        return response.data[0]["id"]


def _persist_ifood_order(order_details: dict[str, Any]) -> dict[str, Any]:
    mapped_items, unresolved_items = _build_ifood_local_items(order_details)
    if unresolved_items:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Existem itens do iFood sem mapeamento para produtos locais.",
                "unresolved_items": unresolved_items,
            },
        )

    try:
        existing = _get_supabase_client().table("pedidos").select("id").eq("pedido_externo_id", order_details.get("id")).limit(1).execute()
        if existing.data:
            return {"pedido_id": existing.data[0]["id"], "created": False}
    except Exception:
        pass

    pedido_id = _create_local_order_with_fallback(_pedido_payload_from_ifood(order_details))

    itens_para_inserir = [
        {
            "pedido_id": pedido_id,
            "produto_id": item["produto_id"],
            "quantidade": item["quantidade"],
            "preco_unitario": item["preco_unitario"],
        }
        for item in mapped_items
    ]

    if itens_para_inserir:
        _get_supabase_client().table("itens_pedido").insert(itens_para_inserir).execute()

    try:
        _get_supabase_client().table("ifood_orders").upsert(
            {
                "order_id": order_details.get("id"),
                "merchant_id": (order_details.get("merchant") or {}).get("id"),
                "display_id": order_details.get("displayId"),
                "payload": order_details,
                "local_pedido_id": pedido_id,
                "updated_at": _utc_now_iso(),
            },
            on_conflict="order_id",
        ).execute()
    except Exception:
        pass

    return {"pedido_id": pedido_id, "created": True}


def _fetch_ifood_order_details(order_id: str) -> dict[str, Any]:
    response = _ifood_request("GET", f"/order/v1.0/orders/{order_id}")
    return response.json()


def _sync_ifood_event(event: dict[str, Any]) -> dict[str, Any]:
    if event.get("fullCode") != "PLACED":
        return {"processed": False, "reason": "Evento recebido, mas nao exige sincronizacao local."}

    order_details = _fetch_ifood_order_details(event["orderId"])
    persisted = _persist_ifood_order(order_details)
    return {
        "processed": True,
        "order_id": order_details.get("id"),
        "local_pedido_id": persisted["pedido_id"],
        "created": persisted["created"],
    }


def _acknowledge_ifood_events(event_ids: list[str]) -> dict[str, Any]:
    unique_event_ids = list(dict.fromkeys([event_id for event_id in event_ids if event_id]))
    if not unique_event_ids:
        raise HTTPException(status_code=400, detail="Nenhum event_id informado para acknowledgment.")

    payload = [{"id": event_id} for event_id in unique_event_ids]
    response = _ifood_request("POST", "/events/v1.0/events/acknowledgment", json=payload)
    _mark_acknowledged(unique_event_ids)

    return {
        "acknowledged": unique_event_ids,
        "ifood_status_code": response.status_code,
    }


def _acknowledge_single_event(event_id: str) -> None:
    _acknowledge_ifood_events([event_id])


def _get_pending_ifood_event_ids() -> list[str]:
    try:
        response = _get_supabase_client().table("ifood_event_logs").select("event_id").is_("acknowledged_at", "null").execute()
        return [item["event_id"] for item in (response.data or []) if item.get("event_id")]
    except Exception:
        return []


def _fetch_estoque_item(entrada: EstoqueEntradaCreate) -> dict[str, Any]:
    if entrada.insumo_id:
        itens = _fetch_table_rows("insumos", {"id": entrada.insumo_id})
    elif entrada.estoque_id:
        itens = _fetch_table_rows("insumos", {"id": entrada.estoque_id})
    else:
        raise HTTPException(status_code=400, detail="Informe insumo_id.")

    if not itens:
        raise HTTPException(status_code=404, detail="Insumo nao encontrado.")
    return itens[0]


def _registrar_movimentacao_estoque(payload: dict[str, Any]) -> None:
    try:
        get_payload = {
            "tipo_movimentacao": payload["tipo_movimentacao"],
            "estoque_alvo": payload["estoque_alvo"],
            "quantidade": payload["quantidade"],
            "origem_tipo": payload["origem_tipo"],
            "origem_id": payload.get("origem_id"),
            "insumo_id": payload.get("insumo_id"),
            "produto_id": payload.get("produto_id"),
            "custo_unitario": payload.get("custo_unitario"),
            "documento": payload.get("documento"),
            "observacao": payload.get("observacao"),
            "created_at": payload.get("created_at") or _utc_now_iso(),
        }
        _get_supabase_client().table("movimentacoes_estoque").insert(get_payload).execute()
    except Exception:
        pass


def _update_estoque_quantity(entrada: EstoqueEntradaCreate) -> dict[str, Any]:
    item = _fetch_estoque_item(entrada)
    quantidade_atual = float(item.get("quantidade_atual") or 0)
    nova_quantidade = quantidade_atual + entrada.quantidade

    response = (
        _get_supabase_client().table("insumos")
        .update({"quantidade_atual": nova_quantidade, "updated_at": _utc_now_iso(), "atualizado_em": _utc_now_iso()})
        .eq("id", item["id"])
        .execute()
    )

    _registrar_movimentacao_estoque(
        {
            "insumo_id": item["id"],
            "tipo_movimentacao": "entrada_mercadoria",
            "estoque_alvo": "insumo",
            "quantidade": entrada.quantidade,
            "custo_unitario": entrada.custo_unitario,
            "documento": entrada.documento,
            "observacao": entrada.observacao or "Entrada manual de mercadoria",
            "origem_tipo": "entrada_mercadoria",
            "origem_id": item["id"],
            "created_at": _utc_now_iso(),
        }
    )

    return response.data[0] if response.data else {**item, "quantidade_atual": nova_quantidade}


def _merchant_path(merchant_id: str, suffix: str = "") -> str:
    base = f"/merchant/v1.0/merchants/{merchant_id}"
    return f"{base}{suffix}"


def _normalizar_mapeamento_ifood(mapping: dict[str, Any]) -> dict[str, Any]:
    produto = mapping.get("produtos") or {}
    return {
        "id": mapping.get("id"),
        "merchant_id": mapping.get("merchant_id"),
        "merchant_item_id": mapping.get("merchant_item_id"),
        "produto_id": mapping.get("produto_id"),
        "observacao": mapping.get("observacao"),
        "created_at": mapping.get("created_at"),
        "updated_at": mapping.get("updated_at"),
        "produto_nome": produto.get("nome"),
    }


def _product_lookup() -> dict[str, dict[str, Any]]:
    response = _get_supabase_client().table("produtos").select("id, nome, preco, ativo").execute()
    return {item["id"]: item for item in (response.data or []) if item.get("id")}


def _listar_produtos(ativos_apenas: bool = False) -> list[dict[str, Any]]:
    query = _get_supabase_client().table("produtos").select("*").order("nome")
    if ativos_apenas:
        query = query.eq("ativo", True)
    response = query.execute()
    return response.data or []


def _insumo_lookup() -> dict[str, dict[str, Any]]:
    response = _get_supabase_client().table("insumos").select("*").execute()
    return {item["id"]: item for item in (response.data or []) if item.get("id")}


def _last_cost_by_insumo() -> dict[str, Any]:
    try:
        response = (
            _get_supabase_client().table("movimentacoes_estoque")
            .select("insumo_id, custo_unitario, created_at")
            .not_.is_("custo_unitario", "null")
            .order("created_at", desc=True)
            .execute()
        )
    except Exception:
        return {}

    custo_por_insumo: dict[str, Any] = {}
    for movimento in response.data or []:
        insumo_id = movimento.get("insumo_id")
        if insumo_id and insumo_id not in custo_por_insumo:
            custo_por_insumo[insumo_id] = movimento.get("custo_unitario")
    return custo_por_insumo


def _listar_insumos_formatados() -> list[dict[str, Any]]:
    custo_por_insumo = _last_cost_by_insumo()
    response = _get_supabase_client().table("insumos").select("*").order("nome").execute()
    itens = response.data or []

    for item in itens:
        item["custo_medio"] = custo_por_insumo.get(item.get("id"))
    return itens


def _listar_estoque_produtos_formatado() -> list[dict[str, Any]]:
    produtos = _product_lookup()
    response = _get_supabase_client().table("estoque_produtos").select("*").order("updated_at", desc=True).execute()
    itens = response.data or []

    for item in itens:
        produto = produtos.get(item.get("produto_id"), {})
        item["produto_nome"] = produto.get("nome", "Produto sem nome")
        item["preco_venda"] = produto.get("preco")
    itens.sort(key=lambda item: item.get("produto_nome") or "")
    return itens


def _upsert_estoque_produto(payload: dict[str, Any]) -> dict[str, Any]:
    response = _get_supabase_client().table("estoque_produtos").upsert(payload, on_conflict="produto_id").execute()
    if response.data:
        return response.data[0]

    consulta = _get_supabase_client().table("estoque_produtos").select("*").eq("produto_id", payload["produto_id"]).limit(1).execute()
    if consulta.data:
        return consulta.data[0]
    return payload


def _movimentar_estoque_produto(
    produto_id: str,
    quantidade: float,
    alerta_minimo: Optional[float] = None,
    observacao: Optional[str] = None,
) -> dict[str, Any]:
    if quantidade == 0:
        raise HTTPException(status_code=400, detail="Informe uma quantidade diferente de zero para movimentar o estoque.")

    consulta = _get_supabase_client().table("estoque_produtos").select("*").eq("produto_id", produto_id).limit(1).execute()
    item = consulta.data[0] if consulta.data else None

    if item:
        quantidade_resultante = float(item.get("quantidade_atual") or 0) + quantidade
        if quantidade_resultante < 0:
            raise HTTPException(status_code=400, detail="A movimentacao deixaria o estoque de produtos prontos negativo.")

        payload = {
            "quantidade_atual": quantidade_resultante,
            "updated_at": _utc_now_iso(),
        }
        if alerta_minimo is not None:
            payload["alerta_minimo"] = alerta_minimo
        if observacao:
            payload["observacao"] = observacao

        response = _get_supabase_client().table("estoque_produtos").update(payload).eq("id", item["id"]).execute()
        return response.data[0] if response.data else {**item, **payload}

    data = {
        "produto_id": produto_id,
        "quantidade_atual": quantidade,
        "alerta_minimo": alerta_minimo or 0,
        "observacao": observacao,
        "updated_at": _utc_now_iso(),
    }
    if quantidade < 0:
        raise HTTPException(status_code=400, detail="Nao e possivel iniciar o estoque de produtos prontos com saldo negativo.")
    return _upsert_estoque_produto(data)


def _listar_pedidos(status_filter: Optional[str] = None) -> list[dict[str, Any]]:
    query = (
        _get_supabase_client().table("pedidos")
        .select(
            """
            id,
            origem,
            status,
            valor_total,
            criado_em,
            referencia_externa,
            itens_pedido (
              quantidade,
              preco_unitario,
              produtos (nome)
            )
            """
        )
        .order("criado_em", desc=False)
    )

    if status_filter:
        query = query.eq("status", status_filter)

    response = query.execute()
    return response.data or []


def _listar_receitas_formatadas() -> list[dict[str, Any]]:
    product_map = _product_lookup()
    insumo_map = _insumo_lookup()
    receitas_response = _get_supabase_client().table("receitas").select("*").order("updated_at", desc=True).execute()
    receita_itens_response = _get_supabase_client().table("receita_itens").select("*").execute()

    itens_by_receita: dict[str, list[dict[str, Any]]] = {}
    for item in receita_itens_response.data or []:
        receita_id = item.get("receita_id")
        insumo_id = item.get("insumo_id")
        if not receita_id or not insumo_id:
            continue

        insumo = insumo_map.get(insumo_id, {})
        itens_by_receita.setdefault(receita_id, []).append(
            {
                "id": item.get("id"),
                "insumo_id": insumo_id,
                "insumo_nome": insumo.get("nome", "Insumo sem nome"),
                "quantidade_insumo": item.get("quantidade_insumo"),
                "unidade_medida": item.get("unidade_medida") or insumo.get("unidade_medida") or "un",
                "estoque_atual": insumo.get("quantidade_atual"),
                "alerta_minimo": insumo.get("alerta_minimo"),
            }
        )

    receitas_formatadas: list[dict[str, Any]] = []
    for receita in receitas_response.data or []:
        produto_id = receita.get("produto_id")
        produto = product_map.get(produto_id, {})
        receitas_formatadas.append(
            {
                "receita_id": receita.get("id"),
                "produto_id": produto_id,
                "produto_nome": produto.get("nome", "Produto sem nome"),
                "nome_receita": receita.get("nome_receita") or produto.get("nome"),
                "rendimento": receita.get("rendimento"),
                "unidade_rendimento": receita.get("unidade_rendimento"),
                "modo_preparo": receita.get("modo_preparo"),
                "observacoes": receita.get("observacoes"),
                "updated_at": receita.get("updated_at"),
                "ingredientes": sorted(itens_by_receita.get(receita.get("id"), []), key=lambda ingredient: ingredient["insumo_nome"]),
            }
        )

    receitas_formatadas.sort(key=lambda item: item["produto_nome"])
    return receitas_formatadas


def _receita_item_count_by_produto() -> dict[str, int]:
    receitas_response = _get_supabase_client().table("receitas").select("id, produto_id").execute()
    receita_itens_response = _get_supabase_client().table("receita_itens").select("receita_id").execute()

    produto_by_receita = {
        receita["id"]: receita["produto_id"]
        for receita in (receitas_response.data or [])
        if receita.get("id") and receita.get("produto_id")
    }

    counts: dict[str, int] = {}
    for item in receita_itens_response.data or []:
        produto_id = produto_by_receita.get(item.get("receita_id"))
        if not produto_id:
            continue
        counts[produto_id] = counts.get(produto_id, 0) + 1
    return counts


def _listar_produtos_com_receita_status(ativos_apenas: bool = False) -> list[dict[str, Any]]:
    produtos = _listar_produtos(ativos_apenas=ativos_apenas)
    item_count_by_produto = _receita_item_count_by_produto()

    for produto in produtos:
        total_ingredientes = item_count_by_produto.get(produto.get("id"), 0)
        produto["tem_receita"] = total_ingredientes > 0
        produto["total_ingredientes"] = total_ingredientes
    return produtos


def _produtos_sem_receita(produto_ids: Iterable[str]) -> list[dict[str, Any]]:
    ids = [produto_id for produto_id in produto_ids if produto_id]
    if not ids:
        return []

    item_count_by_produto = _receita_item_count_by_produto()
    product_map = _product_lookup()

    faltantes: list[dict[str, Any]] = []
    for produto_id in ids:
        if item_count_by_produto.get(produto_id, 0) > 0:
            continue
        produto = product_map.get(produto_id, {})
        faltantes.append(
            {
                "produto_id": produto_id,
                "produto_nome": produto.get("nome", "Produto sem nome"),
            }
        )
    return faltantes


def _garantir_lista_unica_ingredientes(ingredientes: list[Any]) -> None:
    seen: set[str] = set()
    for ingrediente in ingredientes:
        if ingrediente.insumo_id in seen:
            raise HTTPException(status_code=400, detail="Nao repita o mesmo insumo na mesma receita.")
        seen.add(ingrediente.insumo_id)


def _resolver_produto_receita(payload: ReceitaCreate) -> str:
    if payload.produto_id:
        return payload.produto_id

    if not payload.novo_produto:
        raise HTTPException(
            status_code=400,
            detail="Informe um produto existente ou preencha os dados do novo produto final.",
        )

    produto_payload = {
        "nome": payload.novo_produto.nome.strip(),
        "preco": payload.novo_produto.preco_venda,
        "ativo": payload.novo_produto.ativo,
    }
    response = _get_supabase_client().table("produtos").insert(produto_payload).execute()
    produto = response.data[0] if response.data else None
    if not produto or not produto.get("id"):
        raise HTTPException(status_code=500, detail="Nao foi possivel criar o produto final da receita.")
    return produto["id"]


@app.get("/", include_in_schema=False)
def read_root() -> Any:
    index_file = FRONTEND_DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"status": "API Confeitaria online e rodando!"}


@app.get("/api/health")
def healthcheck() -> dict[str, Any]:
    return {
        "status": "ok",
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY),
        "supabase_frontend_configured": bool(SUPABASE_URL and SUPABASE_ANON_KEY),
        "ifood_configured": bool(IFOOD_CLIENT_ID and IFOOD_CLIENT_SECRET),
    }


@app.get("/api/runtime-config")
def runtime_config() -> dict[str, str]:
    return {
        "apiBaseUrl": "",
        "supabaseUrl": SUPABASE_URL or "",
        "supabaseAnonKey": SUPABASE_ANON_KEY or "",
    }


@app.get("/api/produtos")
def listar_produtos(ativos_apenas: bool = Query(default=False)) -> list[dict[str, Any]]:
    try:
        return _listar_produtos_com_receita_status(ativos_apenas=ativos_apenas)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/produtos", status_code=status.HTTP_201_CREATED)
def criar_produto(payload: ProdutoCreate) -> dict[str, Any]:
    try:
        produto_payload = {
            "nome": payload.nome.strip(),
            "preco": payload.preco,
            "ativo": payload.ativo,
        }
        response = _get_supabase_client().table("produtos").insert(produto_payload).execute()
        produto = response.data[0] if response.data else produto_payload
        return {
            "mensagem": "Produto cadastrado com sucesso.",
            "produto": produto,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.patch("/api/produtos/{produto_id}")
def atualizar_produto(produto_id: str, payload: ProdutoUpdate) -> dict[str, Any]:
    try:
        update_payload: dict[str, Any] = {}
        if payload.nome is not None:
            update_payload["nome"] = payload.nome.strip()
        if payload.preco is not None:
            update_payload["preco"] = payload.preco
        if payload.ativo is not None:
            update_payload["ativo"] = payload.ativo

        if not update_payload:
            raise HTTPException(status_code=400, detail="Informe pelo menos um campo para atualizar o produto.")

        response = _get_supabase_client().table("produtos").update(update_payload).eq("id", produto_id).execute()
        produto = response.data[0] if response.data else None
        if not produto:
            consulta = _get_supabase_client().table("produtos").select("*").eq("id", produto_id).limit(1).execute()
            produto = consulta.data[0] if consulta.data else None
        if not produto:
            raise HTTPException(status_code=404, detail="Produto nao encontrado.")

        return {
            "mensagem": "Produto atualizado com sucesso.",
            "produto": produto,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/insumos", status_code=status.HTTP_201_CREATED)
def criar_insumo(payload: InsumoCreate) -> dict[str, Any]:
    try:
        insumo_payload = {
            "nome": payload.nome.strip(),
            "ativo": payload.ativo,
            "quantidade_atual": payload.quantidade_inicial,
            "alerta_minimo": payload.alerta_minimo,
            "unidade_medida": payload.unidade_medida.strip(),
            "atualizado_em": _utc_now_iso(),
        }
        insumo_response = _get_supabase_client().table("insumos").insert(insumo_payload).execute()
        insumo = insumo_response.data[0]

        if payload.quantidade_inicial > 0:
            _registrar_movimentacao_estoque(
                {
                    "insumo_id": insumo["id"],
                    "tipo_movimentacao": "entrada_inicial",
                    "estoque_alvo": "insumo",
                    "quantidade": payload.quantidade_inicial,
                    "custo_unitario": payload.custo_medio,
                    "observacao": "Cadastro inicial do insumo",
                    "origem_tipo": "ajuste_manual",
                    "origem_id": insumo["id"],
                    "created_at": _utc_now_iso(),
                }
            )

        return {
            "mensagem": "Insumo cadastrado com sucesso.",
            "insumo": insumo,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/estoque/produtos")
def listar_estoque_produtos() -> list[dict[str, Any]]:
    try:
        return _listar_estoque_produtos_formatado()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/estoque/produtos", status_code=status.HTTP_201_CREATED)
def cadastrar_produto_no_estoque(payload: EstoqueProdutoCreate) -> dict[str, Any]:
    try:
        data = {
            "produto_id": payload.produto_id,
            "quantidade_atual": payload.quantidade_inicial,
            "alerta_minimo": payload.alerta_minimo,
            "updated_at": _utc_now_iso(),
        }
        estoque_produto = _upsert_estoque_produto(data)
        return {
            "mensagem": "Produto pronto vinculado ao estoque com sucesso.",
            "estoque_produto": estoque_produto,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/estoque/produtos/movimentar")
def movimentar_estoque_produtos(payload: EstoqueProdutoMovimentoCreate) -> dict[str, Any]:
    try:
        tipo_movimentacao = (payload.tipo_movimentacao or "entrada").strip().lower()
        if tipo_movimentacao not in {"entrada", "saida"}:
            raise HTTPException(status_code=400, detail="tipo_movimentacao deve ser 'entrada' ou 'saida'.")

        quantidade = abs(payload.quantidade)
        if tipo_movimentacao == "saida":
            quantidade *= -1

        estoque_produto = _movimentar_estoque_produto(
            produto_id=payload.produto_id,
            quantidade=quantidade,
            alerta_minimo=payload.alerta_minimo,
            observacao=payload.observacao,
        )
        _registrar_movimentacao_estoque(
            {
                "produto_id": payload.produto_id,
                "tipo_movimentacao": "entrada_manual" if tipo_movimentacao == "entrada" else "saida_manual",
                "estoque_alvo": "produto_pronto",
                "quantidade": abs(payload.quantidade),
                "observacao": payload.observacao or "Ajuste manual de estoque de produto pronto",
                "origem_tipo": "ajuste_manual",
                "origem_id": payload.produto_id,
                "created_at": _utc_now_iso(),
            }
        )
        return {
            "mensagem": "Movimentacao de produto pronto registrada com sucesso.",
            "estoque_produto": estoque_produto,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/estoque/produtos/entrada")
def registrar_entrada_produto(payload: EstoqueProdutoEntradaCreate) -> dict[str, Any]:
    try:
        estoque_produto = _movimentar_estoque_produto(
            produto_id=payload.produto_id,
            quantidade=payload.quantidade,
            observacao=payload.observacao,
        )
        _registrar_movimentacao_estoque(
            {
                "produto_id": payload.produto_id,
                "tipo_movimentacao": "entrada_manual",
                "estoque_alvo": "produto_pronto",
                "quantidade": payload.quantidade,
                "observacao": payload.observacao or "Entrada manual de produto pronto",
                "origem_tipo": "ajuste_manual",
                "origem_id": payload.produto_id,
                "created_at": _utc_now_iso(),
            }
        )
        return {
            "mensagem": "Entrada de produto pronto registrada com sucesso.",
            "estoque_produto": estoque_produto,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/receitas")
def listar_receitas() -> list[dict[str, Any]]:
    try:
        return _listar_receitas_formatadas()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/receitas", status_code=status.HTTP_201_CREATED)
def salvar_receita(payload: ReceitaCreate) -> dict[str, Any]:
    try:
        produto_id = _resolver_produto_receita(payload)

        if any(ingrediente.insumo_id == produto_id for ingrediente in payload.ingredientes):
            raise HTTPException(status_code=400, detail="O produto final nao pode ser usado como insumo da propria receita.")

        _garantir_lista_unica_ingredientes(payload.ingredientes)

        receita_payload = {
            "produto_id": produto_id,
            "nome_receita": payload.nome_receita or None,
            "rendimento": payload.rendimento,
            "unidade_rendimento": payload.unidade_rendimento,
            "modo_preparo": payload.modo_preparo,
            "observacoes": payload.observacoes,
            "updated_at": _utc_now_iso(),
        }
        receita_response = _get_supabase_client().table("receitas").upsert(receita_payload, on_conflict="produto_id").execute()
        receita = receita_response.data[0] if receita_response.data else None
        if not receita or not receita.get("id"):
            consulta = _get_supabase_client().table("receitas").select("id").eq("produto_id", produto_id).limit(1).execute()
            receita = consulta.data[0] if consulta.data else None
        if not receita or not receita.get("id"):
            raise HTTPException(status_code=500, detail="Nao foi possivel localizar a receita apos salvar o cabecalho.")

        _get_supabase_client().table("receita_itens").delete().eq("receita_id", receita["id"]).execute()
        linhas_receita = [
            {
                "receita_id": receita["id"],
                "insumo_id": ingrediente.insumo_id,
                "quantidade_insumo": ingrediente.quantidade_insumo,
                "unidade_medida": ingrediente.unidade_medida,
            }
            for ingrediente in payload.ingredientes
        ]
        _get_supabase_client().table("receita_itens").insert(linhas_receita).execute()

        receita_salva = next(
            (item for item in _listar_receitas_formatadas() if item["produto_id"] == produto_id),
            None,
        )
        return {
            "mensagem": "Receita salva com sucesso.",
            "receita": receita_salva,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao salvar receita. Confira se a reestruturacao do banco foi aplicada. Detalhe: {exc}",
        ) from exc


@app.get("/api/estoque/insumos")
def listar_insumos_estoque() -> list[dict[str, Any]]:
    try:
        return _listar_insumos_formatados()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/estoque/entrada")
def registrar_entrada_mercadoria(entrada: EstoqueEntradaCreate) -> dict[str, Any]:
    try:
        estoque_atualizado = _update_estoque_quantity(entrada)
        return {
            "mensagem": "Entrada de mercadoria registrada com sucesso.",
            "estoque": estoque_atualizado,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/ifood/item-mappings")
def listar_mapeamentos_ifood() -> list[dict[str, Any]]:
    try:
        response = (
            _get_supabase_client().table("ifood_item_mappings")
            .select("id, merchant_id, merchant_item_id, produto_id, observacao, created_at, updated_at, produtos(nome)")
            .order("created_at", desc=True)
            .execute()
        )
        return [_normalizar_mapeamento_ifood(item) for item in (response.data or [])]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/ifood/item-mappings", status_code=status.HTTP_201_CREATED)
def criar_mapeamento_ifood(payload: IfoodItemMappingCreate) -> dict[str, Any]:
    try:
        data = {
            "merchant_id": payload.merchant_id,
            "merchant_item_id": payload.merchant_item_id.strip(),
            "produto_id": payload.produto_id,
            "observacao": payload.observacao,
            "updated_at": _utc_now_iso(),
        }
        response = (
            _get_supabase_client().table("ifood_item_mappings")
            .upsert(data, on_conflict="merchant_id,merchant_item_id")
            .execute()
        )
        mapping = response.data[0] if response.data else data
        return {
            "mensagem": "Mapeamento iFood salvo com sucesso.",
            "mapping": mapping,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/ifood/webhook", status_code=status.HTTP_202_ACCEPTED)
async def receber_evento_ifood(request: Request) -> dict[str, Any]:
    raw_body = await request.body()
    _safe_compare_signature(raw_body, request.headers.get("X-IFood-Signature"))

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Payload JSON invalido.") from exc

    try:
        event = IfoodWebhookEvent.model_validate(payload).model_dump()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Evento iFood invalido: {exc}") from exc

    try:
        sync_result = _sync_ifood_event(event)
        _record_ifood_event(event, "processed")
        _acknowledge_single_event(event["id"])
        return {
            "received": True,
            "event_id": event["id"],
            "sync_result": sync_result,
        }
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail, ensure_ascii=False)
        _record_ifood_event(event, "error", error_message=detail)
        return {
            "received": True,
            "event_id": event["id"],
            "processing_status": "deferred",
            "detail": exc.detail,
        }
    except Exception as exc:
        _record_ifood_event(event, "error", error_message=str(exc))
        return {
            "received": True,
            "event_id": event["id"],
            "processing_status": "deferred",
            "detail": str(exc),
        }


@app.post("/api/ifood/events/acknowledgment")
def confirmar_recebimento_ifood(payload: IfoodAckRequest) -> dict[str, Any]:
    event_ids = payload.event_ids or _get_pending_ifood_event_ids()
    return _acknowledge_ifood_events(event_ids)


@app.get("/api/ifood/merchants")
def listar_merchants_ifood() -> Any:
    response = _ifood_request("GET", "/merchant/v1.0/merchants")
    return response.json()


@app.get("/api/ifood/merchants/{merchant_id}/status")
def consultar_status_merchant_ifood(merchant_id: str) -> Any:
    status_response = _ifood_request("GET", _merchant_path(merchant_id, "/status"))
    interruptions_response = _ifood_request("GET", _merchant_path(merchant_id, "/interruptions"))
    return {
        "status": status_response.json(),
        "interruptions": interruptions_response.json(),
    }


@app.post("/api/ifood/merchants/{merchant_id}/close", status_code=status.HTTP_202_ACCEPTED)
def fechar_loja_ifood(merchant_id: str, payload: IfoodCloseStoreRequest) -> Any:
    start = datetime.now(timezone.utc)
    end = start + timedelta(minutes=payload.duration_minutes)
    interruption_payload = {
        "description": payload.description,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
    response = _ifood_request("POST", _merchant_path(merchant_id, "/interruptions"), json=interruption_payload)
    return {
        "message": "Solicitacao de fechamento enviada ao iFood.",
        "interruption": response.json(),
    }


@app.post("/api/ifood/merchants/{merchant_id}/open")
def abrir_loja_ifood(merchant_id: str, payload: IfoodOpenStoreRequest) -> Any:
    interruption_id = payload.interruption_id
    if not interruption_id:
        status_payload = consultar_status_merchant_ifood(merchant_id)
        reopenable = (status_payload.get("status") or {}).get("reopenable") or {}
        interruption_id = reopenable.get("identifier")

        if not interruption_id:
            interruptions = status_payload.get("interruptions") or []
            if interruptions:
                interruption_id = interruptions[0].get("id")

    if not interruption_id:
        raise HTTPException(
            status_code=409,
            detail="Nao foi encontrada uma interrupcao removivel para reabrir a loja.",
        )

    _ifood_request("DELETE", _merchant_path(merchant_id, f"/interruptions/{interruption_id}"))
    return {
        "message": "Solicitacao de reabertura enviada ao iFood.",
        "interruption_id": interruption_id,
    }


if FRONTEND_DIST_DIR.exists():
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    public_entries = ["vite.svg", "manifest.webmanifest", "registerSW.js", "sw.js", "workbox-*.js"]
    for entry in FRONTEND_DIST_DIR.iterdir():
        if entry.is_file() and any(entry.match(pattern) for pattern in public_entries):
            route_path = f"/{entry.name}"

            async def serve_public_file(file_path: Path = entry) -> FileResponse:
                return FileResponse(file_path)

            app.add_api_route(route_path, serve_public_file, methods=["GET"])

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend_app(full_path: str) -> FileResponse:
        requested_file = FRONTEND_DIST_DIR / full_path
        if full_path and requested_file.exists() and requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
