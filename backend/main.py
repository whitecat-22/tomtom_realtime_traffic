import os
import logging
from typing import Optional, Dict, Any, Literal
import urllib.parse

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# --- ロギング設定 ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")
logging.getLogger("httpx").setLevel(logging.WARNING)  # httpx の DEBUG ログ (APIキー含む) を抑制

# --- 環境変数の読み込み (.env ファイルから) ---
load_dotenv()
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY")
TOMTOM_BASE_URL = os.getenv("TOMTOM_BASE_URL", "https://api.tomtom.com")
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", 8001))


if not TOMTOM_API_KEY:
    raise ValueError("TOMTOM_API_KEY is not set in the environment variables or .env file.")

# --- HTTPX クライアント (非同期、接続プール) ---
client: Optional[httpx.AsyncClient] = None

# --- FastAPI アプリケーション ---
app = FastAPI()

# --- CORS 設定 ---
origins = [
    "http://localhost:5173",
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
    # logger.debug(f"Calling TomTom API: {api_path} with params (key excluded): {log_params}")

    request_params = params.copy()
    request_params["key"] = TOMTOM_API_KEY  # APIキーをここで追加

    try:
        response = await client.get(api_path, params=request_params)
        response.raise_for_status()  # HTTPエラー (4xx or 5xx) があれば例外を発生させる

        content_type = response.headers.get("content-type", "").lower()
        # logger.debug(f"Received Content-Type: {content_type} for {api_path}")

        if expected_content_type_prefix:
            if content_type.startswith(expected_content_type_prefix):
                pass  # OK
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
    """指定されたベース地図とTomTom交通流・インシデントタイルを含むスタイルJSONを生成"""
    host = request.url.hostname or "localhost"
    port = request.url.port or FASTAPI_PORT
    scheme = request.url.scheme or "http"
    base_url = f"{scheme}://{host}:{port}"

    traffic_flow_tile_url = f"{base_url}/api/traffic/flow-tiles/{{z}}/{{x}}/{{y}}.pbf"
    traffic_incident_tile_url = f"{base_url}/api/traffic/incident-tiles/{{z}}/{{x}}/{{y}}.pbf"

    # logger.info(f"Generating style for base map: {base_map_type}")

    base_map_config = BASE_MAPS[base_map_type]

    style = {
        "version": 8,
        "sources": {
            # 1. ベースマップソース
            base_map_config["source_id"]: base_map_config["source"],
            # 2. 交通流タイルソース
            "tomtom-traffic-flow": {
                "type": "vector",
                "tiles": [traffic_flow_tile_url],
                "maxzoom": 22,
                "attribution": '&copy; TomTom / &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            },
            # 3. インシデントタイルソース
            "tomtom-traffic-incidents": {
                "type": "vector",
                "tiles": [traffic_incident_tile_url],
                "maxzoom": 22,
                "attribution": '&copy; TomTom / &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },
        "layers": [
            # 1. ベースマップレイヤー
            {
                "id": base_map_config["layer_id"],
                "type": "raster",
                "source": base_map_config["source_id"],
            },
            # 2. 交通流レイヤー
            {
                "id": "tomtom-traffic-layer",
                "type": "line",
                "source": "tomtom-traffic-flow",
                "source-layer": "Traffic flow",
                "paint": {
                    "line-color": [
                        "interpolate", ["linear"], ["get", "traffic_level"],
                        0,  '#f73027',
                        10, '#fc8d59',
                        20, '#fdbb2d',
                        30, '#7cb342',
                        40, '#56B458',
                        50, '#1a9850',
                        60, '#26c6da',
                        70, '#007bfa',
                        80, '#004CB0'
                    ],
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        9, 3,
                        12, 6,
                        15, 9
                    ]
                }
            },
            # 3. インシデントレイヤー (ポイント)
            #{
            #    "id": "tomtom-traffic-incident-point-layer",
            #    "type": "circle",
            #    "source": "tomtom-traffic-incidents",
            #    "source-layer": "Traffic incident POI",
            #    "paint": {
            #        "circle-color": [
            #            "match",
            #            ["get", "icon_category"],
            #            0, "#808080",  # Unknown
            #            1, "#ffe043",  # Accident
            #            2, "#c0c0ff",  # Fog
            #            3, "#f40000",  # Dangerous Conditions
            #            4, "#0000ff",  # Rain
            #            5, "#00ccff",  # Ice
            #            6, "#fcc000",  # Jam
            #            7, "#ff8000",  # Lane Closed
            #            8, "#ff00ff",  # Road Closed
            #            9, "#ffff00",  # Road Works
            #            10, "#00f000", # Wind
            #            11, "#808080", # Flooding
            #            13, "#800080", # Cluster: Returned if a cluster contains incidents with different icon categories.
            #            14, "#000000", # Broken Down Vehicle
            #            "#808080"
            #        ],
            #        "circle-stroke-width": 2,
            #        "circle-stroke-color": [
            #            "match",
            #            ["get", "icon_category"],
            #            0, "#ffffff",
            #            "#ffffff"
            #        ],
            #        "circle-radius": [
            #            "interpolate", ["linear"], ["zoom"],
            #            8, 4,
            #            12, 8,
            #            16, 12
            #        ]
            #    }
            #},
            # 4. インシデントレイヤー (ライン - 縞模様の外枠)
            {
                "id": "tomtom-traffic-incident-layer-outline",
                "type": "line",
                "source": "tomtom-traffic-incidents",
                "source-layer": "Traffic incident flow",
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    # 「外枠」の実線
                    "line-color": [
                        "interpolate", ["linear"], ["coalesce", ["get", "magnitude"], 0],
                        0, '#00004c',
                        1, '#f58240',
                        2, '#eb4c13',
                        3, '#ab0000',
                        4, '#666666'
                    ],
                    # 全体の太さ
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        9, 7,
                        12, 10,
                        15, 13
                    ]
                }
            },
            #  5. インシデントレイヤー (ライン - 縞模様の中心線)
            {
                "id": "tomtom-traffic-incident-layer-dash",
                "type": "line",
                "source": "tomtom-traffic-incidents",
                "source-layer": "Traffic incident flow",
                "layout": {
                    "line-cap": "round",
                    "line-join": "round"
                },
                "paint": {
                    # 「中心」の破線の色 (元の中心線色)
                    "line-color": [
                        "interpolate", ["linear"], ["coalesce", ["get", "magnitude"], 0],
                        0, '#b2b2b2',
                        1, '#ffce43',
                        2, '#ff8939',
                        3, '#f40000',
                        4, '#c1272d'
                    ],
                    # 破線のパターン [実線, 空白] (線の太さの比率)
                    "line-dasharray": [0.5, 0.5],

                    # 破線の太さ (外枠より少し細くする)
                    "line-width": [
                        "interpolate", ["linear"], ["zoom"],
                        9, 3,   # 外枠(7) より細く
                        12, 6,  # 外枠(10) より細く
                        15, 9   # 外枠(13) より細く
                    ]
                }
            }
        ]
    }
    return style


@app.get("/api/map/style.json")  # デフォルト (Positron)
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


@app.get("/api/traffic/flow-tiles/{z}/{x}/{y}.pbf")  # パス名を flow-tiles に変更
async def get_traffic_flow_tile(z: int, x: int, y: int):
    """TomTom Traffic Flow Tile APIをプロキシする"""
    road_types_param = "[0,1,2,3,4,5,6]"
    tags_param = "[road_type,traffic_level,traffic_road_coverage,left_hand_traffic,road_closure,road_category,road_subcategory]"

    log_params_str = f"roadTypes={road_types_param}&tags={tags_param}"
    # logger.info(f"Calling TomTom Flow Tile API: /traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.pbf with {log_params_str}")

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
        # logger.info(f"Successfully fetched flow tile {z}/{x}/{y}. Content-Type: {response.headers.get('content-type')}, Start (hex): {tile_data[:50].hex()}")

        content_type = response.headers.get("content-type", "").lower()
        media_type = "application/vnd.mapbox-vector-tile"
        if content_type.startswith("application/protobuf"):
            media_type = "application/protobuf"
        elif content_type.startswith("application/octet-stream"):
            media_type = "application/vnd.mapbox-vector-tile"
        elif content_type.startswith("image/pbf"):
            media_type = "application/vnd.mapbox-vector-tile"

        # logger.debug(f"Returning flow tile for {z}/{x}/{y} with media_type: {media_type}")
        return Response(content=tile_data, media_type=media_type)
    except HTTPException as exc:
        raise exc


# Traffic Incident Tile API プロキシ
@app.get("/api/traffic/incident-tiles/{z}/{x}/{y}.pbf")
async def get_traffic_incident_tile(z: int, x: int, y: int):
    """TomTom Traffic Incident Tile API (v4) をプロキシする"""

    # ドキュメントに基づき、Flow tag と POI tag を指定 (type を削除)
    # tags_param = "[]"  # "[icon_category, description, delay, road_type, left_hand_traffic, magnitude, traffic_road_coverage, clustered]" #, end_date, id, probability_of_occurrence, number_of_reports, last_report_time, road_category, road_subcategory]"
    #tags_param = "[icon_category,description,delay,road_type,left_hand_traffic,magnitude,traffic_road_coverage,clustered]"
    tags_param = "[icon_category,description,delay,road_type,left_hand_traffic,magnitude,traffic_road_coverage,clustered,end_date,id,probability_of_occurrence,number_of_reports,last_report_time,road_category,road_subcategory]"
    language_param = "en-US"
    params = {
        "tags": tags_param
    }

    log_params_str = f"tags={tags_param}&language={language_param}"
    api_path = f"/traffic/map/4/tile/incidents/{z}/{x}/{y}.pbf"
    # logger.info(f"Calling TomTom Incident Tile API: {api_path} with {log_params_str}")

    try:
        response = await get_tomtom_data(
            api_path,
            params=params,
            expected_content_type_prefix="application/vnd.mapbox-vector-tile"
        )
        tile_data = response.content
        # 成功した場合、レスポンス内容の一部をログに出力 (デバッグ用)
        # logger.info(f"Successfully fetched incident tile {z}/{x}/{y}. Content-Type: {response.headers.get('content-type')}, Start (hex): {tile_data[:50].hex()}")

        content_type = response.headers.get("content-type", "").lower()
        media_type = "application/vnd.mapbox-vector-tile"
        if content_type.startswith("application/protobuf"):
            media_type = "application/protobuf"
        elif content_type.startswith("application/octet-stream"):
            media_type = "application/vnd.mapbox-vector-tile"
        elif content_type.startswith("image/pbf"):
            media_type = "application/vnd.mapbox-vector-tile"

        # logger.debug(f"Returning incident tile for {z}/{x}/{y} with media_type: {media_type}")
        return Response(content=tile_data, media_type=media_type)
    except HTTPException as exc:
        raise exc


# Geocoding API エンドポイント
@app.get("/api/geocode")
async def get_traffic_geocode(q: str):
    """
    TomTom Search API (Geocoding) を呼び出し、地名から座標を取得する
    """
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    # TomTom Search API (v2) の geocode エンドポイント
    # クエリ文字列をURLエンコードする
    api_path = f"/search/2/geocode/{urllib.parse.quote(q)}.json"

    params = {
        "limit": 1,          # 最も関連性の高い1件のみ取得
        "language": "en-US"
    }

    logger.info(f"Calling TomTom Geocode API for query: {q}")

    try:
        # get_tomtom_data は JSON 応答も処理できる (expected_content_type_prefix を指定しない場合)
        response = await get_tomtom_data(api_path, params=params)
        data = response.json()

        if data and data.get("results"):
            result = data["results"][0]
            pos = result.get("position")

            if pos and pos.get("lat") is not None and pos.get("lon") is not None:
                logger.info(f"Geocode success for '{q}': {pos}")
                return {"latitude": pos["lat"], "longitude": pos["lon"]}
            else:
                logger.warning(f"Geocode result for '{q}' missing position data: {result}")
                raise HTTPException(status_code=404, detail="Position data not found in geocode result")
        else:
            logger.info(f"Geocode no results for: {q}")
            raise HTTPException(status_code=404, detail="Location not found")

    except HTTPException as exc:
        # get_tomtom_data が発生させたエラーをそのまま再送出
        raise exc
    except Exception as e:
        logger.error(f"Unexpected error during geocoding: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during geocoding")


if __name__ == "__main__":
    import uvicorn
    load_dotenv()
    port = FASTAPI_PORT
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
