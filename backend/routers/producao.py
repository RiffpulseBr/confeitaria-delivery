from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, status

from common import get_supabase_client, utc_now_iso
from schemas import OrdemProducaoCreate

router = APIRouter(prefix="/api/ordens-producao", tags=["producao"])


def _product_lookup() -> dict[str, dict[str, Any]]:
    response = get_supabase_client().table("produtos").select("id, nome, preco, ativo").execute()
    return {item["id"]: item for item in (response.data or []) if item.get("id")}


def _receita_lookup_by_produto() -> dict[str, dict[str, Any]]:
    receitas_response = get_supabase_client().table("receitas").select(
        "id, produto_id, rendimento, unidade_rendimento"
    ).execute()
    receita_itens_response = get_supabase_client().table("receita_itens").select("receita_id").execute()

    produto_by_receita = {
        receita["id"]: receita
        for receita in (receitas_response.data or [])
        if receita.get("id") and receita.get("produto_id")
    }

    counts: dict[str, int] = {}
    for item in receita_itens_response.data or []:
        receita = produto_by_receita.get(item.get("receita_id"))
        if not receita:
            continue
        produto_id = receita["produto_id"]
        counts[produto_id] = counts.get(produto_id, 0) + 1

    receitas_por_produto: dict[str, dict[str, Any]] = {}
    for receita in produto_by_receita.values():
        produto_id = receita["produto_id"]
        receitas_por_produto[produto_id] = {
            "receita_id": receita["id"],
            "rendimento": receita.get("rendimento") or 1,
            "unidade_rendimento": receita.get("unidade_rendimento") or "un",
            "total_ingredientes": counts.get(produto_id, 0),
        }
    return receitas_por_produto


def _estoque_produto_lookup() -> dict[str, dict[str, Any]]:
    response = get_supabase_client().table("estoque_produtos").select("*").execute()
    return {item["produto_id"]: item for item in (response.data or []) if item.get("produto_id")}


def _formatar_ordens(raw_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    produtos = _product_lookup()
    estoque_produto = _estoque_produto_lookup()
    receitas_por_produto = _receita_lookup_by_produto()
    ordens: list[dict[str, Any]] = []

    for ordem in raw_rows:
        produto_id = ordem.get("produto_id")
        produto = produtos.get(produto_id, {})
        estoque = estoque_produto.get(produto_id, {})
        receita = receitas_por_produto.get(produto_id, {})
        rendimento = float(receita.get("rendimento") or 1)
        quantidade_lotes = float(ordem.get("quantidade_produzida") or 0)
        ordens.append(
            {
                **ordem,
                "produto_nome": produto.get("nome", "Produto sem nome"),
                "produto_ativo": produto.get("ativo", True),
                "total_ingredientes": receita.get("total_ingredientes", 0),
                "tem_receita": receita.get("total_ingredientes", 0) > 0,
                "rendimento_receita": rendimento,
                "unidade_rendimento": receita.get("unidade_rendimento", "un"),
                "quantidade_final_prevista": quantidade_lotes * rendimento,
                "estoque_produto_atual": estoque.get("quantidade_atual", 0),
            }
        )

    ordens.sort(key=lambda item: (item.get("status") != "em_producao", item.get("status") != "pendente", item.get("created_at") or ""), reverse=False)
    return ordens


def _buscar_ordem(ordem_id: str) -> dict[str, Any]:
    response = get_supabase_client().table("ordens_producao").select("*").eq("id", ordem_id).limit(1).execute()
    ordem = response.data[0] if response.data else None
    if not ordem:
        raise HTTPException(status_code=404, detail="Ordem de producao nao encontrada.")
    return ordem


def _garantir_receita_para_produto(produto_id: str) -> None:
    receitas = get_supabase_client().table("receitas").select("id").eq("produto_id", produto_id).limit(1).execute()
    receita = receitas.data[0] if receitas.data else None
    if not receita:
        raise HTTPException(status_code=422, detail="O produto selecionado nao possui receita cadastrada.")

    ingredientes = get_supabase_client().table("receita_itens").select("id").eq("receita_id", receita["id"]).limit(1).execute()
    if not ingredientes.data:
        raise HTTPException(status_code=422, detail="A receita do produto nao possui ingredientes cadastrados.")


def _atualizar_status_ordem(ordem_id: str, novo_status: str) -> dict[str, Any]:
    ordem = _buscar_ordem(ordem_id)
    status_atual = ordem.get("status")

    if status_atual == novo_status:
        return ordem

    if status_atual in {"concluida", "cancelada"}:
        raise HTTPException(status_code=409, detail=f"Nao e possivel alterar uma ordem com status {status_atual}.")

    payload: dict[str, Any] = {"status": novo_status, "updated_at": utc_now_iso()}
    if novo_status == "concluida":
        payload["concluida_em"] = utc_now_iso()

    response = get_supabase_client().table("ordens_producao").update(payload).eq("id", ordem_id).execute()
    ordem_atualizada = response.data[0] if response.data else None
    return ordem_atualizada or {**ordem, **payload}


@router.get("")
def listar_ordens_producao(status: Optional[str] = Query(default=None)) -> list[dict[str, Any]]:
    try:
        query = get_supabase_client().table("ordens_producao").select("*").order("created_at", desc=True)
        if status:
            query = query.eq("status", status)
        response = query.execute()
        return _formatar_ordens(response.data or [])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{ordem_id}")
def detalhar_ordem_producao(ordem_id: str) -> dict[str, Any]:
    try:
        ordem = _buscar_ordem(ordem_id)
        return _formatar_ordens([ordem])[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
def criar_ordem_producao(payload: OrdemProducaoCreate) -> dict[str, Any]:
    try:
        _garantir_receita_para_produto(payload.produto_id)
        data = {
            "produto_id": payload.produto_id,
            "quantidade_produzida": payload.quantidade_produzida,
            "status": "pendente",
            "observacao": payload.observacao,
            "created_at": utc_now_iso(),
            "updated_at": utc_now_iso(),
        }
        response = get_supabase_client().table("ordens_producao").insert(data).execute()
        ordem = response.data[0] if response.data else data
        return {
            "mensagem": "Ordem de producao criada com sucesso.",
            "ordem_producao": _formatar_ordens([ordem])[0],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{ordem_id}/iniciar")
def iniciar_ordem_producao(ordem_id: str) -> dict[str, Any]:
    try:
        ordem = _buscar_ordem(ordem_id)
        if ordem.get("status") not in {"pendente", "em_producao"}:
            raise HTTPException(status_code=409, detail="Apenas ordens pendentes podem ser iniciadas.")

        ordem_atualizada = _atualizar_status_ordem(ordem_id, "em_producao")
        return {
            "mensagem": "Ordem de producao iniciada com sucesso.",
            "ordem_producao": _formatar_ordens([ordem_atualizada])[0],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{ordem_id}/concluir")
def concluir_ordem_producao(ordem_id: str) -> dict[str, Any]:
    try:
        ordem = _buscar_ordem(ordem_id)
        if ordem.get("status") not in {"pendente", "em_producao"}:
            raise HTTPException(status_code=409, detail="Apenas ordens pendentes ou em producao podem ser concluidas.")

        _garantir_receita_para_produto(ordem["produto_id"])
        ordem_atualizada = _atualizar_status_ordem(ordem_id, "concluida")
        return {
            "mensagem": "Ordem de producao concluida com sucesso.",
            "ordem_producao": _formatar_ordens([ordem_atualizada])[0],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao concluir a ordem de producao: {exc}") from exc


@router.post("/{ordem_id}/cancelar")
def cancelar_ordem_producao(ordem_id: str) -> dict[str, Any]:
    try:
        ordem = _buscar_ordem(ordem_id)
        if ordem.get("status") not in {"pendente", "em_producao"}:
            raise HTTPException(status_code=409, detail="Apenas ordens pendentes ou em producao podem ser canceladas.")

        ordem_atualizada = _atualizar_status_ordem(ordem_id, "cancelada")
        return {
            "mensagem": "Ordem de producao cancelada com sucesso.",
            "ordem_producao": _formatar_ordens([ordem_atualizada])[0],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
