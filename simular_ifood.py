import hashlib
import hmac
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request
from uuid import uuid4

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
BACKEND_ENV = ROOT_DIR / "backend" / ".env"


def carregar_ambiente() -> None:
    if BACKEND_ENV.exists():
        load_dotenv(BACKEND_ENV)
    else:
        load_dotenv()


def assinar_payload(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def montar_mock_order(merchant_id: str, merchant_item_id: str, quantidade: int) -> dict:
    order_id = str(uuid4())
    return {
        "id": order_id,
        "displayId": f"TESTE-{order_id[:8].upper()}",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "merchant": {
            "id": merchant_id,
            "name": "Loja Teste iFood",
        },
        "total": {
            "orderAmount": round(quantidade * 12.5, 2),
        },
        "items": [
            {
                "uniqueId": str(uuid4()),
                "name": "Produto Teste via Webhook",
                "quantity": quantidade,
                "unitPrice": 12.5,
                "merchantItemId": merchant_item_id,
                "externalCode": merchant_item_id,
            }
        ],
    }


def montar_evento(mock_order: dict) -> dict:
    return {
        "id": str(uuid4()),
        "code": "ORDER_STATUS",
        "fullCode": "PLACED",
        "orderId": mock_order["id"],
        "merchantId": mock_order["merchant"]["id"],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "salesChannel": "IFOOD",
        "metadata": {
            "mock_order": mock_order,
        },
    }


def main() -> int:
    carregar_ambiente()

    webhook_url = os.getenv("SIMULADOR_IFOOD_WEBHOOK_URL", "http://localhost:8000/api/ifood/webhook")
    secret = os.getenv("IFOOD_CLIENT_SECRET")
    merchant_id = os.getenv("SIMULADOR_IFOOD_MERCHANT_ID", "11111111-1111-1111-1111-111111111111")
    merchant_item_id = os.getenv("SIMULADOR_IFOOD_MERCHANT_ITEM_ID", "BRIGADEIRO-TRAD-001")
    quantidade = int(os.getenv("SIMULADOR_IFOOD_QUANTIDADE", "1"))

    if not secret:
        print("IFOOD_CLIENT_SECRET nao encontrado no ambiente.", file=sys.stderr)
        return 1

    mock_order = montar_mock_order(merchant_id, merchant_item_id, quantidade)
    evento = montar_evento(mock_order)
    payload = json.dumps(evento, ensure_ascii=False).encode("utf-8")
    signature = assinar_payload(payload, secret)

    print("Enviando evento simulado para:", webhook_url)
    print("merchant_id:", merchant_id)
    print("merchant_item_id:", merchant_item_id)
    print("order_id:", mock_order["id"])

    req = request.Request(
        webhook_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-IFood-Signature": signature,
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=30) as response:
            body = response.read().decode("utf-8")
            print("status_code:", response.status)
            try:
                print(json.dumps(json.loads(body), indent=2, ensure_ascii=False))
            except ValueError:
                print(body)
            return 0
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        print("status_code:", exc.code)
        try:
            print(json.dumps(json.loads(body), indent=2, ensure_ascii=False))
        except ValueError:
            print(body)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
