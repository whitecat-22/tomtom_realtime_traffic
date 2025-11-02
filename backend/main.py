import os
import logging
from typing import Optional, Dict, Any, Literal

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# --- ロギング設定 ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")
logging.getLogger("httpx").setLevel(logging.WARNING) # httpx の DEBUG ログ (APIキー含む) を抑制

# --- 環境変数の読み込み (.env ファイルから) ---
load_dotenv()
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY")
# 【修正】TOMTOM_BASE_URL を環境変数から読み込む (デフォルト値付き)
TOMTOM_BASE_URL = os.getenv("TOMTOM_BASE_URL", "https://api.tomtom.com")
# 【修正】FASTAPI_PORT を環境変数から読み込む (デフォルト値付き)
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", 8001))


if not TOMTOM_API_KEY:
    raise ValueError("TOMTOM_API_KEY is not set in the environment variables or .env file.")

# --- HTTPX クライアント (非同期、接続プール) ---
# ベースURLは startup イベントで設定
client: Optional[httpx.AsyncClient] = None

# --- FastAPI アプリケーション ---
app = FastAPI()

# --- CORS 設定 ---
origins = [
    "http://localhost:5173", # Vite のデフォルトポート
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FastAPI イベントハンドラ ---
@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時に HTTPX クライアントを初期化"""
    global client
    # 【修正】環境変数から読み込んだ TOMTOM_BASE_URL を使用
    client = httpx.AsyncClient(base_url=TOMTOM_BASE_URL)
    logger.info(f"HTTPX Client started for base URL: {TOMTOM_BASE_URL}")

@app.on_event("shutdown")
async def shutdown_event():
    """アプリケーション終了時に HTTPX クライアントを閉じる"""
    if client:
        await client.aclose()
        logger.info("HTTPX Client closed.")

# --- ヘルパー関数: TomTom API 呼び出し ---
async def get_tomtom_data(
    api_path: str,
    params: Optional[Dict[str, Any]] = None,
    expected_content_type_prefix: Optional[str] = None
) -> httpx.Response:
    """TomTom APIを呼び出し、エラーハンドリングを行う"""
    if client is None:
        raise HTTPException(status_code=500, detail="HTTPX client not initialized")

    if params is None:
        params = {}
    log_params = {k: v for k, v in params.items() if k != 'key'}
    logger.debug(f"Calling TomTom API: {api_path} with params (key excluded): {log_params}")

    request_params = params.copy()
    request_params["key"] = TOMTOM_API_KEY # APIキーをここで追加

    try:
        response = await client.get(api_path, params=request_params)
        response.raise_for_status() # HTTPエラー (4xx or 5xx) があれば例外を発生させる

        content_type = response.headers.get("content-type", "").lower()
        logger.debug(f"Received Content-Type: {content_type} for {api_path}")

        # Content-Type チェックと pbf の処理
        if expected_content_type_prefix:
            if content_type.startswith(expected_content_type_prefix):
                pass # OK
            elif content_type.startswith("application/protobuf") or content_type.startswith("application/octet-stream") or content_type.startswith("image/pbf"):
                 logger.warning(f"Received Content-Type '{content_type}' for {api_path}. Treating as vector tile.")
                 pass
            else:
                 logger.warning(
                    f"Unexpected Content-Type '{content_type}' from TomTom API for {api_path}. "
                    f"Expected prefix: '{expected_content_type_prefix}'. Returning raw content."
                 )
        return response

    except httpx.HTTPStatusError as exc:
        try:
            error_detail = exc.response.json()
        except Exception:
            error_detail = exc.response.text[:500]
        logger.error(f"TomTom API Error: {exc.response.status_code} - Detail: {error_detail}")
        raise HTTPException(status_code=exc.response.status_code, detail=error_detail)
    except httpx.RequestError as exc:
        logger.error(f"TomTom Request Error: {exc}")
        raise HTTPException(status_code=503, detail=f"Failed to connect to TomTom API: {exc}")

# --- ベース地図定義 ---
BaseMapType = Literal["positron", "darkmatter", "osm-standard", "satellite"]

BASE_MAPS: Dict[BaseMapType, Dict[str, Any]] = {
    "positron": {
        "source_id": "cartodb-positron",
        "source": {
            "type": "raster",
            "tiles": ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
            "tileSize": 256,
            "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            "maxzoom": 19
        },
        "layer_id": "cartodb-base-layer"
    },
    "darkmatter": {
         "source_id": "cartodb-darkmatter",
         "source": {
             "type": "raster",
             "tiles": ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
             "tileSize": 256,
             "attribution": '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
             "maxzoom": 19
         },
         "layer_id": "cartodb-dark-layer"
     },
     "osm-standard": {
          "source_id": "osm-standard",
          "source": {
              "type": "raster",
              "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              "tileSize": 256,
              "attribution": '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              "maxzoom": 19
          },
          "layer_id": "osm-standard-layer"
      },
      "satellite": {
           "source_id": "esri-world-imagery",
           "source": {
               "type": "raster",
               "tiles": ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
               "tileSize": 256,
               "attribution": 'Tiles &copy; Esri &mdash; Source: Esri, et al.',
               "maxzoom": 19
           },
           "layer_id": "esri-imagery-layer"
       }
}

# --- ヘルパー関数: スタイルJSON生成 ---
def create_map_style(request: Request, base_map_type: BaseMapType) -> Dict[str, Any]:
    """指定されたベース地図とTomTom交通流を含むスタイルJSONを生成"""
    host = request.url.hostname or "localhost"
    # 【修正】ポート番号を環境変数から取得した値で構築
    port = request.url.port or FASTAPI_PORT
    scheme = request.url.scheme or "http"
    base_url = f"{scheme}://{host}:{port}"
    traffic_tile_url_template = f"{base_url}/api/traffic/tiles/{{z}}/{{x}}/{{y}}.pbf"
    logger.info(f"Generating style for base map: {base_map_type}")
    logger.info(f"Generated traffic tile URL template (base): {traffic_tile_url_template}")

    base_map_config = BASE_MAPS[base_map_type]

    style = {
        "version": 8,
        "sources": {
            base_map_config["source_id"]: base_map_config["source"],
            "tomtom-traffic": {
                "type": "vector",
                "tiles": [traffic_tile_url_template],
                "maxzoom": 22,
                "attribution": "&copy; TomTom"
            }
        },
        "layers": [
             {
                 "id": base_map_config["layer_id"],
                 "type": "raster",
                 "source": base_map_config["source_id"],
             },
            {
                "id": "tomtom-traffic-layer",
                "type": "line",
                "source": "tomtom-traffic",
                "source-layer": "Traffic flow",
                "paint": {
                    "line-color": [
                        "interpolate", ["linear"], ["get", "traffic_level"],
                        0, '#f73027', 10, '#fc8d59', 20, '#fdbb2d',
                        30, '#7cb342', 40, '#56B458', 50, '#1a9850',
                        60, '#26c6da', 70, '#007bfa', 80, '#004CB0'
                    ],
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        9, 3, 12, 6, 15, 9
                    ]
                }
            }
        ]
    }
    return style


@app.get("/api/map/style.json") # デフォルト (Positron)
async def get_map_style_default(request: Request):
    return create_map_style(request, "positron")

@app.get("/api/map/style-dark.json")
async def get_map_style_dark(request: Request):
    return create_map_style(request, "darkmatter")

@app.get("/api/map/style-osm-standard.json")
async def get_map_style_osm_standard(request: Request):
    return create_map_style(request, "osm-standard")

@app.get("/api/map/style-satellite.json")
async def get_map_style_satellite(request: Request):
    return create_map_style(request, "satellite")


@app.get("/api/traffic/tiles/{z}/{x}/{y}.pbf")
async def get_traffic_tile(z: int, x: int, y: int):
    """TomTom Traffic Flow Tile APIをプロキシし、常に roadTypes と tags を追加する"""
    road_types_param = "[1,2,3,4,5,6]"
    tags_param = "[road_type,traffic_level,traffic_road_coverage,left_hand_traffic,road_closure,road_category,road_subcategory]"

    log_params_str = f"roadTypes={road_types_param}&tags={tags_param}"
    logger.info(f"Calling TomTom Tile API: /traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.pbf with {log_params_str}")

    api_path = f"/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.pbf"

    params = {
        "roadTypes": road_types_param,
        "tags": tags_param
    }

    try:
        response = await get_tomtom_data(
            api_path,
            params=params,
            expected_content_type_prefix="application/vnd.mapbox-vector-tile"
        )
        tile_data = response.content
        content_type = response.headers.get("content-type", "").lower()
        media_type = "application/vnd.mapbox-vector-tile"
        if content_type.startswith("application/protobuf"):
            media_type = "application/protobuf"
        elif content_type.startswith("application/octet-stream"):
             media_type = "application/vnd.mapbox-vector-tile"
        elif content_type.startswith("image/pbf"):
             media_type = "application/vnd.mapbox-vector-tile"

        logger.debug(f"Returning tile for {z}/{x}/{y} with media_type: {media_type}")
        return Response(content=tile_data, media_type=media_type)
    except HTTPException as exc:
        raise exc

# --- Incident API エンドポイントはコメントアウト中 ---
# @app.get("/api/traffic/incidents")
# async def get_traffic_incidents(request: Request, bbox: str):
#    ... (省略) ...

if __name__ == "__main__":
    import uvicorn
    # .env ファイルを確実に読み込む
    load_dotenv()
    # 【修正】ポート番号を環境変数 FASTAPI_PORT から読み込む
    port = int(os.getenv("FASTAPI_PORT", 8001)) # デフォルトは 8001
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

