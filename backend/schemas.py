from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ItemPedidoCreate(BaseModel):
    produto_id: str
    quantidade: int
    preco_unitario: float


class PedidoCreate(BaseModel):
    origem: str
    valor_total: float
    itens: List[ItemPedidoCreate]


class IfoodAckEvent(BaseModel):
    id: str


class IfoodAckRequest(BaseModel):
    event_ids: List[str] = Field(default_factory=list)


class EstoqueEntradaCreate(BaseModel):
    estoque_id: Optional[str] = None
    produto_id: Optional[str] = None
    quantidade: float = Field(gt=0)
    custo_unitario: Optional[float] = Field(default=None, ge=0)
    observacao: Optional[str] = None
    documento: Optional[str] = None


class IfoodCloseStoreRequest(BaseModel):
    duration_minutes: int = Field(default=60, ge=5, le=1440)
    description: str = "Pausa temporaria via painel administrativo"


class IfoodOpenStoreRequest(BaseModel):
    interruption_id: Optional[str] = None


class IfoodItemMappingCreate(BaseModel):
    merchant_id: str
    merchant_item_id: str = Field(min_length=1)
    produto_id: str
    observacao: Optional[str] = None


class InsumoCreate(BaseModel):
    nome: str = Field(min_length=2)
    unidade_medida: str = Field(min_length=1, max_length=20)
    quantidade_inicial: float = Field(default=0, ge=0)
    alerta_minimo: float = Field(default=0, ge=0)
    custo_medio: Optional[float] = Field(default=None, ge=0)
    preco_venda: float = Field(default=0, ge=0)
    ativo: bool = True


class ReceitaIngredienteCreate(BaseModel):
    insumo_id: str
    quantidade_insumo: float = Field(gt=0)
    unidade_medida: Optional[str] = Field(default=None, max_length=20)


class ReceitaCreate(BaseModel):
    produto_id: str
    nome_receita: Optional[str] = None
    rendimento: Optional[float] = Field(default=None, gt=0)
    unidade_rendimento: Optional[str] = Field(default=None, max_length=20)
    modo_preparo: Optional[str] = None
    observacoes: Optional[str] = None
    ingredientes: List[ReceitaIngredienteCreate] = Field(min_length=1)


class IfoodOAuthToken(BaseModel):
    access_token: str
    expires_in: int
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"


class IfoodWebhookEvent(BaseModel):
    id: str
    code: str
    fullCode: str
    orderId: Optional[str] = None
    merchantId: Optional[str] = None
    createdAt: Optional[str] = None
    salesChannel: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
