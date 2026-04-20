import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from supabase import Client, create_client

from schemas import (
    EstoqueEntradaCreate,
    IfoodAckRequest,
    IfoodCloseStoreRequest,
    IfoodItemMappingCreate,
    IfoodOAuthToken,
    IfoodOpenStoreRequest,
    IfoodWebhookEvent,
    PedidoCreate,
)

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
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
    if entrada.estoque_id:
        itens = _fetch_table_rows("estoque", {"id": entrada.estoque_id})
    elif entrada.produto_id:
        itens = _fetch_table_rows("estoque", {"produto_id": entrada.produto_id})
    else:
        raise HTTPException(status_code=400, detail="Informe estoque_id ou produto_id.")

    if not itens:
        raise HTTPException(status_code=404, detail="Item de estoque nao encontrado.")
    return itens[0]


def _update_estoque_quantity(entrada: EstoqueEntradaCreate) -> dict[str, Any]:
    item = _fetch_estoque_item(entrada)
    quantidade_atual = float(item.get("quantidade_atual") or 0)
    nova_quantidade = quantidade_atual + entrada.quantidade

    response = (
        _get_supabase_client().table("estoque")
        .update({"quantidade_atual": nova_quantidade, "atualizado_em": _utc_now_iso()})
        .eq("id", item["id"])
        .execute()
    )

    try:
        _get_supabase_client().table("movimentacoes_estoque").insert(
            {
                "estoque_id": item["id"],
                "produto_id": item.get("produto_id"),
                "tipo_movimentacao": "entrada",
                "quantidade": entrada.quantidade,
                "custo_unitario": entrada.custo_unitario,
                "documento": entrada.documento,
                "observacao": entrada.observacao,
                "origem": "painel_admin",
                "created_at": _utc_now_iso(),
            }
        ).execute()
    except Exception:
        pass

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


@app.get("/")
def read_root() -> dict[str, str]:
    return {"status": "API Confeitaria online e rodando!"}


@app.get("/api/health")
def healthcheck() -> dict[str, Any]:
    return {
        "status": "ok",
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY),
        "ifood_configured": bool(IFOOD_CLIENT_ID and IFOOD_CLIENT_SECRET),
    }


@app.get("/api/produtos")
def listar_produtos() -> list[dict[str, Any]]:
    try:
        response = _get_supabase_client().table("produtos").select("*").eq("ativo", True).execute()
        return response.data
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/pedidos")
def criar_pedido(pedido: PedidoCreate) -> dict[str, Any]:
    try:
        novo_pedido = {
            "origem": pedido.origem,
            "status": "pendente",
            "valor_total": pedido.valor_total,
        }
        res_pedido = _get_supabase_client().table("pedidos").insert(novo_pedido).execute()
        pedido_id = res_pedido.data[0]["id"]

        itens_para_inserir = [
            {
                "pedido_id": pedido_id,
                "produto_id": item.produto_id,
                "quantidade": item.quantidade,
                "preco_unitario": item.preco_unitario,
            }
            for item in pedido.itens
        ]

        _get_supabase_client().table("itens_pedido").insert(itens_para_inserir).execute()
        return {"mensagem": "Pedido criado com sucesso!", "pedido_id": pedido_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/estoque/insumos")
def listar_insumos_estoque() -> list[dict[str, Any]]:
    try:
        response = (
            _get_supabase_client().table("estoque")
            .select("id, quantidade_atual, alerta_minimo, unidade_medida, produto_id, produtos(nome)")
            .order("quantidade_atual", desc=False)
            .execute()
        )
        return response.data or []
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
