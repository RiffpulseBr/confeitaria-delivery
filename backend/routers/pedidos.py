from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from common import get_supabase_client
from schemas import PedidoCreate

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])


def _listar_pedidos(status_filter: Optional[str] = None) -> list[dict[str, Any]]:
    query = (
        get_supabase_client()
        .table("pedidos")
        .select(
            """
            id,
            origem,
            status,
            valor_total,
            criado_em,
            referencia_externa,
            itens_pedido (
              produto_id,
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


def _carregar_estoque_produtos() -> dict[str, dict[str, Any]]:
    response = get_supabase_client().table("estoque_produtos").select("*").execute()
    return {item["produto_id"]: item for item in (response.data or []) if item.get("produto_id")}


def _carregar_produtos() -> dict[str, dict[str, Any]]:
    response = get_supabase_client().table("produtos").select("id, nome, ativo").execute()
    return {item["id"]: item for item in (response.data or []) if item.get("id")}


def _consolidar_itens_pedido(itens: list[Any]) -> dict[str, float]:
    quantidades: dict[str, float] = {}
    for item in itens:
        produto_id = item.produto_id if hasattr(item, "produto_id") else item.get("produto_id")
        quantidade = item.quantidade if hasattr(item, "quantidade") else item.get("quantidade")
        if not produto_id:
            continue
        quantidades[produto_id] = quantidades.get(produto_id, 0) + float(quantidade or 0)
    return quantidades


def _validar_saldo_produtos(quantidades_por_produto: dict[str, float]) -> list[dict[str, Any]]:
    estoque_por_produto = _carregar_estoque_produtos()
    produtos = _carregar_produtos()
    insuficientes: list[dict[str, Any]] = []

    for produto_id, quantidade_necessaria in quantidades_por_produto.items():
        produto = produtos.get(produto_id, {})
        estoque_produto = estoque_por_produto.get(produto_id)
        saldo_atual = float((estoque_produto or {}).get("quantidade_atual") or 0)

        if saldo_atual < quantidade_necessaria:
            insuficientes.append(
                {
                    "produto_id": produto_id,
                    "produto_nome": produto.get("nome", "Produto sem nome"),
                    "saldo_atual": saldo_atual,
                    "quantidade_solicitada": quantidade_necessaria,
                }
            )

    return insuficientes


@router.get("")
def listar_pedidos(status: Optional[str] = Query(default=None)) -> list[dict[str, Any]]:
    try:
        return _listar_pedidos(status_filter=status)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("")
def criar_pedido(pedido: PedidoCreate) -> dict[str, Any]:
    try:
        if not pedido.itens:
            raise HTTPException(status_code=400, detail="Informe pelo menos um item para criar o pedido.")

        insuficientes = _validar_saldo_produtos(_consolidar_itens_pedido(pedido.itens))
        if insuficientes:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Saldo insuficiente em estoque_produtos para registrar a venda.",
                    "itens_insuficientes": insuficientes,
                },
            )

        novo_pedido = {
            "origem": pedido.origem,
            "status": "pendente",
            "valor_total": pedido.valor_total,
        }
        res_pedido = get_supabase_client().table("pedidos").insert(novo_pedido).execute()
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

        get_supabase_client().table("itens_pedido").insert(itens_para_inserir).execute()
        return {"mensagem": "Pedido criado com sucesso!", "pedido_id": pedido_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{pedido_id}/concluir")
def concluir_pedido(pedido_id: str) -> dict[str, Any]:
    try:
        consulta = (
            get_supabase_client()
            .table("pedidos")
            .select(
                """
                id,
                status,
                itens_pedido (
                  produto_id,
                  quantidade,
                  produtos (nome)
                )
                """
            )
            .eq("id", pedido_id)
            .limit(1)
            .execute()
        )
        pedido = consulta.data[0] if consulta.data else None
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido nao encontrado.")

        if pedido.get("status") == "concluido":
            return {
                "mensagem": "Pedido ja estava concluido.",
                "pedido_id": pedido_id,
            }

        itens = pedido.get("itens_pedido") or []
        if not itens:
            raise HTTPException(status_code=400, detail="Pedido sem itens nao pode ser concluido.")

        insuficientes = _validar_saldo_produtos(_consolidar_itens_pedido(itens))
        if insuficientes:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Saldo insuficiente em estoque_produtos para concluir o pedido.",
                    "itens_insuficientes": insuficientes,
                },
            )

        response = (
            get_supabase_client()
            .table("pedidos")
            .update({"status": "concluido"})
            .eq("id", pedido_id)
            .execute()
        )
        return {
            "mensagem": "Pedido concluido com sucesso.",
            "pedido": response.data[0] if response.data else {"id": pedido_id, "status": "concluido"},
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao concluir pedido: {exc}") from exc
