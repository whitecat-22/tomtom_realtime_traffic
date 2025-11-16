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
logging.getLogger("httpx").setLevel(logging.WARNING)

# --- 環境変数の読み込み (.env ファイルから) ---
load_dotenv()
TOMTOM_API_KEY = os.getenv("TOMTOM_API_KEY")
TOMTOM_BASE_URL = os.getenv("TOMTOM_BASE_URL", "https://api.tomtom.com")
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", 8001))


if not TOMTOM_API_KEY:
    raise ValueError("TOMTOM_API_KEY is not set in the environment variables or .env file.")

# --- HTTPX クライアント (非同期、接続プール) ---
client: Optional[httpx.AsyncClient] = None

# --- FastAPI イベントハンドラ (lifespan に変更) ---
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーション起動・終了時のイベントハンドラ"""
    # 起動時
    global client
    client = httpx.AsyncClient(base_url=TOMTOM_BASE_URL)
    logger.info(f"HTTPX Client started for base URL: {TOMTOM_BASE_URL}")
    yield
    # 終了時
    if client:
        await client.aclose()
        logger.info("HTTPX Client closed.")

# --- FastAPI アプリケーション ---
app = FastAPI(lifespan=lifespan)

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

    request_params = params.copy()
    request_params["key"] = TOMTOM_API_KEY  # APIキーをここで追加

    try:
        response = await client.get(api_path, params=request_params)
        response.raise_for_status()  # HTTPエラー (4xx or 5xx) があれば例外を発生させる

        content_type = response.headers.get("content-type", "").lower()

        if expected_content_type_prefix:
            if not content_type.startswith(expected_content_type_prefix):
                 # image/pbf などを許可
                if not (content_type.startswith("application/protobuf") or \
                        content_type.startswith("application/octet-stream") or \
                        content_type.startswith("image/pbf")):
                    logger.warning(
                        f"Unexpected Content-Type '{content_type}' from TomTom API for {api_path}. "
                        f"Expected prefix: '{expected_content_type_prefix}'. Returning raw content."
                    )
        return response

    except httpx.HTTPStatusError as exc:
        try:
            # TomTomのエラーを detail に詰める
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
    host = request.url.hostname or "localhost"
    port = request.url.port or FASTAPI_PORT
    scheme = request.url.scheme or "http"
    base_url = f"{scheme}://{host}:{port}"
    traffic_flow_tile_url = f"{base_url}/api/traffic/flow-tiles/{{z}}/{{x}}/{{y}}.pbf"
    traffic_incident_tile_url = f"{base_url}/api/traffic/incident-tiles/{{z}}/{{x}}/{{y}}.pbf"
    base_map_config = BASE_MAPS[base_map_type]
    style = {
        "version": 8,
        "sources": {
            base_map_config["source_id"]: base_map_config["source"],
            "tomtom-traffic-flow": {
                "type": "vector",
                "tiles": [traffic_flow_tile_url],
                "maxzoom": 22,
                "attribution": '&copy; TomTom / &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            },
            "tomtom-traffic-incidents": {
                "type": "vector",
                "tiles": [traffic_incident_tile_url],
                "maxzoom": 22,
                "attribution": '&copy; TomTom / &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
                "source": "tomtom-traffic-flow",
                "source-layer": "Traffic flow",
                "paint": {
                    "line-color": [
                        "interpolate", ["linear"], ["get", "traffic_level"],
                        0,  '#f73027', 10, '#fc8d59', 20, '#fdbb2d',
                        30, '#7cb342', 40, '#56B458', 50, '#1a9850',
                        60, '#26c6da', 70, '#007bfa', 80, '#004CB0'
                    ],
                    "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3, 12, 6, 15, 9]
                }
            },
            {
                "id": "tomtom-traffic-incident-layer-outline",
                "type": "line",
                "source": "tomtom-traffic-incidents",
                "source-layer": "Traffic incident flow",
                "layout": {"line-join": "round", "line-cap": "round"},
                "paint": {
                    "line-color": [
                        "interpolate", ["linear"], ["coalesce", ["get", "magnitude"], 0],
                        0, '#00004c', 1, '#f58240', 2, '#eb4c13',
                        3, '#ab0000', 4, '#666666'
                    ],
                    "line-width": ["interpolate", ["linear"], ["zoom"], 9, 7, 12, 10, 15, 13]
                }
            },
            {
                "id": "tomtom-traffic-incident-layer-dash",
                "type": "line",
                "source": "tomtom-traffic-incidents",
                "source-layer": "Traffic incident flow",
                "layout": {"line-cap": "round", "line-join": "round"},
                "paint": {
                    "line-color": [
                        "interpolate", ["linear"], ["coalesce", ["get", "magnitude"], 0],
                        0, '#b2b2b2', 1, '#ffce43', 2, '#ff8939',
                        3, '#f40000', 4, '#c1272d'
                    ],
                    "line-dasharray": [0.5, 0.5],
                    "line-width": ["interpolate", ["linear"], ["zoom"], 9, 3, 12, 6, 15, 9]
                }
            }
        ]
    }
    return style

@app.get("/api/map/style.json")
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

# --- タイルAPI ---
@app.get("/api/traffic/flow-tiles/{z}/{x}/{y}.pbf")
async def get_traffic_flow_tile(z: int, x: int, y: int):
    road_types_param = "[0,1,2,3,4,5,6,7,8]"
    tags_param = "[road_type,traffic_level,traffic_road_coverage,left_hand_traffic,road_closure,road_category,road_subcategory]"
    logger.debug(f"Calling TomTom Flow Tile API: /traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.pbf")
    api_path = f"/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.pbf"
    params = {"roadTypes": road_types_param, "tags": tags_param}
    try:
        response = await get_tomtom_data(
            api_path, params=params,
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
        return Response(content=tile_data, media_type=media_type)
    except HTTPException as exc:
        raise exc

@app.get("/api/traffic/incident-tiles/{z}/{x}/{y}.pbf")
async def get_traffic_incident_tile(z: int, x: int, y: int):
    tags_param = "[icon_category,description,delay,road_type,left_hand_traffic,magnitude,traffic_road_coverage,clustered,end_date,id,probability_of_occurrence,number_of_reports,last_report_time,road_category,road_subcategory]"
    params = {"tags": tags_param}
    api_path = f"/traffic/map/4/tile/incidents/{z}/{x}/{y}.pbf"
    logger.debug(f"Calling TomTom Incident Tile API: {api_path}")
    try:
        response = await get_tomtom_data(
            api_path, params=params,
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
        return Response(content=tile_data, media_type=media_type)
    except HTTPException as exc:
        raise exc

@app.get("/api/geocode")
async def get_traffic_geocode(q: str):
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    api_path = f"/search/2/geocode/{urllib.parse.quote(q)}.json"
    params = { "limit": 1, "language": "en-US" }
    logger.info(f"Calling TomTom Geocode API for query: {q}")
    try:
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
                raise HTTPException(status_code=404, detail="Position data not found")
        else:
            logger.info(f"Geocode no results for: {q}")
            raise HTTPException(status_code=404, detail="Location not found")
    except HTTPException as exc:
        raise exc
    except Exception as e:
        logger.error(f"Unexpected error during geocoding: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# --- v4 API エンドポイント ---
@app.get("/api/traffic/flow-segment/absolute/{z}/json")
async def get_traffic_flow_segment(z: int, lat: float, lon: float):
    """
    TomTom Flow Segment Data API (v4) をプロキシする
    """
    api_path = f"/traffic/services/4/flowSegmentData/absolute/{z}/json"
    point = f"{lat},{lon}"
    params = {
        "point": point,
        "unit": "kmph"
    }
    logger.info(f"Calling TomTom Flow Segment Data API (v4) for point: {point} at zoom: {z}")
    try:
        response = await get_tomtom_data(api_path, params=params)
        return response.json()
    except HTTPException as exc:
        raise exc
    except Exception as e:
        logger.error(f"Unexpected error during flow segment data fetch: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/traffic/incident-detail/{detail_id}")
async def get_traffic_incident_detail(detail_id: str):
    """
    TomTom Incident Details API (v5) をプロキシする
    """
    api_path = f"/traffic/services/5/incidentDetails"

    fields_param = "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity,probabilityOfOccurrence,numberOfReports,lastReportTime,tmc{countryCode,tableNumber,tableVersion,direction,points{location,offset}}}}}"

    params = {
        "ids": detail_id,
        "language": "en-US",
        "fields": fields_param
    }

    logger.info(f"Calling TomTom Incident Details API for ID: {detail_id}")

    try:
        response = await get_tomtom_data(api_path, params=params)
        return response.json()
    except HTTPException as exc:
        if exc.status_code == 404:
             logger.warning(f"Incident detail not found (404) for ID: {detail_id}")
        raise exc
    except Exception as e:
        logger.error(f"Unexpected error during incident detail fetch: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn
    load_dotenv()
    port = FASTAPI_PORT
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
