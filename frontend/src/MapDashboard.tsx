import React, { useState, useEffect, useRef, useCallback } from "react";
import { Map, ScaleControl, Source, Layer } from "react-map-gl/maplibre";
import type { MapRef, ViewState } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
// --- api.ts をインポート
import { api } from "./api";

// --- react-icons のインポート ---
import {
  LuMap,
  LuLayers,
  LuTriangleAlert,
  LuPlus,
  LuMinus,
  LuLogIn,
  LuSettings,
} from "react-icons/lu";
import { BsPinFill, BsPinAngle } from "react-icons/bs";
import { VscTriangleUp, VscTriangleDown } from "react-icons/vsc";
import {
  FaSearchLocation,
  FaGlobeAmericas,
  FaWindowClose,
} from "react-icons/fa";
import { FaCar, FaSpinner } from "react-icons/fa6";
import { GiHorizonRoad } from "react-icons/gi";
import { BiErrorAlt } from "react-icons/bi";
import { MdNotifications, MdLegendToggle } from "react-icons/md";

// --- 初期視点を環境変数から読み込む ---
const INITIAL_VIEW_STATE = {
  longitude: parseFloat(import.meta.env.VITE_INITIAL_LONGITUDE || "139.7494616"),
  latitude: parseFloat(import.meta.env.VITE_INITIAL_LATITUDE || "35.6869628"),
  zoom: parseInt(import.meta.env.VITE_INITIAL_ZOOM || "10", 10),
  pitch: 0,
  bearing: 0,
};

// --- 凡例データ ---
const legendData = [
  { speed: ' 0-10', color: '#f73027' },
  { speed: '10-20', color: '#fc8d59' },
  { speed: '20-30', color: '#fdbb2d' },
  { speed: '30-40', color: '#7cb342' },
  { speed: '40-50', color: '#56B458' },
  { speed: '50-60', color: '#1a9850' },
  { speed: '60-70', color: '#26c6da' },
  { speed: '70-80', color: '#007bfa' },
  { speed: '80-',   color: '#004CB0' },
];

// --- 道路種別データ (Orbis 道路カテゴリ) ---
const roadTypeData = [
  { id: "motorway", label: "Motorway" },
  { id: "trunk", label: "Trunk road" },
  { id: "primary", label: "Primary road" },
  { id: "secondary", label: "Secondary road" },
  { id: "tertiary", label: "Tertiary road" },
  { id: "street", label: "Street" },
  { id: "service", label: "Service road" },
  { id: "track", label: "Track" },
];

/*
// --- 天気図レイヤー定義 ---
const weatherLayers = [
  { id: 'clouds', label: 'Clouds', url: 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=' },
  { id: 'precipitation', label: 'Precipitation', url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' },
  { id: 'pressure', label: 'Sea Level Pressure', url: 'https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=' },
  { id: 'wind', label: 'Wind Speed', url: 'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=' },
  { id: 'temp', label: 'Temperature', url: 'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' },
];
*/

/*
const OWM_API_KEY = import.meta.env.VITE_OWM_API_KEY || '';
*/
const WEATHERAPI_KEY = import.meta.env.VITE_WEATHERAPI_KEY || "";
/*
const TOMORROW_IO_API_KEY = import.meta.env.VITE_TOMORROW_IO_API_KEY || '';
*/

/*
// --- Tomorrow.io レイヤー定義 ---
const tomorrowIoLayers = [
  { id: 'ti-temperature', field: 'temperature', label: 'Temperature' },
  { id: 'ti-windSpeed', field: 'windSpeed', label: 'Wind Speed' },
  { id: 'ti-pressureSeaLevel', field: 'pressureSeaLevel', label: 'Pressure (Sea Level)' },
  { id: 'ti-precipitationType', field: 'precipitationType', label: 'Precipitation Type' },
  { id: 'ti-precipitationIntensity', field: 'precipitationIntensity', label: 'Precipitation Intensity' },
  { id: 'ti-precipitationProbability', field: 'precipitationProbability', label: 'Precipitation Probability' },
  { id: 'ti-rainIntensity', field: 'rainIntensity', label: 'Rain Intensity' },
  { id: 'ti-rainAccumulation', field: 'rainAccumulation', label: 'Rain Accumulation' },
  { id: 'ti-thunderstormProbability', field: 'thunderstormProbability', label: 'Thunderstorm Probability' },
  { id: 'ti-snowIntensity', field: 'snowIntensity', label: 'Snow Intensity' },
  { id: 'ti-snowAccumulation', field: 'snowAccumulation', label: 'Snow Accumulation' },
  { id: 'ti-snowDepth', field: 'snowDepth', label: 'Snow Depth' },
  { id: 'ti-visibility', field: 'visibility', label: 'Visibility' },
];
*/

// --- WeatherAPI.com レイヤー定義 ---
// ドキュメント(画像)に基づき、APIキー不要の新しいエンドポイント形式に対応
// URLテンプレート内の {date} と {hour} はレンダリング時に置換する
const weatherApiLayers = [
  {
    id: "wa-temp",
    label: "Temperature",
    url: "https://weathermaps.weatherapi.com/tmp2m/tiles/{date}{hour}/{z}/{x}/{y}.png",
  },
  {
    id: "wa-precip",
    label: "Precipitation",
    url: "https://weathermaps.weatherapi.com/precip/tiles/{date}{hour}/{z}/{x}/{y}.png",
  },
  {
    id: "wa-wind",
    label: "Wind Speed",
    url: "https://weathermaps.weatherapi.com/wind/tiles/{date}{hour}/{z}/{x}/{y}.png",
  },
  {
    id: "wa-pressure",
    label: "Pressure (Sea Level)",
    url: "https://weathermaps.weatherapi.com/pressure/tiles/{date}{hour}/{z}/{x}/{y}.png",
  },
];

// 現在のUTC日時を取得してパラメータ用の文字列を返すヘルパー
const getWeatherMapParams = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return {
    date: `${year}${month}${day}`,
    hour: hour,
  };
};

// フィルタ対象のレイヤーIDをコンポーネント外の定数として定義
const layersToFilter = [
  "tomtom-traffic-layer",
  "tomtom-traffic-incident-layer-outline",
  "tomtom-traffic-incident-layer-dash",
];

// --- 開閉式凡例コンポーネント ---
const LegendControl = ({
  visibleLayers,
}: {
  visibleLayers: { [key: string]: boolean };
}) => {
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const openStyle: React.CSSProperties = {
    backgroundColor: "rgba(30,30,30,0.8)",
    color: "white",
    border: "1px solid #555",
    padding: "10px",
    borderRadius: "5px",
    zIndex: 1,
    fontFamily: "sans-serif",
    fontSize: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    cursor: "pointer",
    maxHeight: "300px",
    overflowY: "auto",
  };
  const closedStyle: React.CSSProperties = {
    backgroundColor: "#333",
    color: "white",
    border: "1px solid #555",
    padding: "5px",
    cursor: "pointer",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  };

  // WeatherAPI.com 凡例データ (CSS Gradients based on reference images)
  const weatherLegends: Record<
    string,
    {
      title: string;
      gradient: string;
      ticks: { label: string; percent: number }[];
    }
  > = {
    "wa-temp": {
      title: "Temperature (°C)",
      // Blue -> Cyan -> Green -> Yellow -> Red
      gradient:
        "linear-gradient(to right, #000080 0%, #0000FF 25%, #00FFFF 45%, #00FF00 60%, #FFFF00 75%, #FFA500 85%, #FF0000 100%)",
      ticks: [
        { label: "-50", percent: 0 },
        { label: "-20", percent: 33 },
        { label: "0", percent: 55 },
        { label: "20", percent: 77 },
        { label: "40", percent: 100 },
      ],
    },
    "wa-precip": {
      title: "Precipitation (mm)",
      // Light Blue -> Blue -> Green -> Yellow -> Orange -> Red
      gradient:
        "linear-gradient(to right, #E0F7FA 0%, #2196F3 20%, #4CAF50 40%, #FFEB3B 60%, #FF9800 80%, #F44336 100%)",
      ticks: [
        { label: "0", percent: 0 },
        { label: "5", percent: 16 },
        { label: "10", percent: 33 },
        { label: "20", percent: 66 },
        { label: "30", percent: 100 },
      ],
    },
    "wa-wind": {
      title: "Wind Speed (m/s)",
      // White -> Blue -> Green -> Yellow -> Red -> Purple
      gradient:
        "linear-gradient(to right, #FFFFFF 0%, #00FFFF 15%, #0000FF 30%, #00FF00 50%, #FFFF00 70%, #FF0000 85%, #800080 100%)",
      ticks: [
        { label: "0", percent: 0 },
        { label: "10", percent: 20 },
        { label: "20", percent: 40 },
        { label: "30", percent: 60 },
        { label: "40", percent: 80 },
        { label: "50", percent: 100 },
      ],
    },
    "wa-pressure": {
      title: "Pressure (hPa)",
      // Purple -> Blue -> Light Blue -> White -> Yellow -> Orange -> Red
      gradient:
        "linear-gradient(to right, #800080 0%, #0000FF 20%, #00BFFF 40%, #FFFFFF 50%, #FFFF00 60%, #FFA500 80%, #FF0000 100%)",
      ticks: [
        { label: "940", percent: 0 },
        { label: "980", percent: 33 },
        { label: "1000", percent: 50 },
        { label: "1020", percent: 66 },
        { label: "1060", percent: 100 },
      ],
    },
  };

  if (isLegendOpen) {
    return (
      <div style={openStyle} onClick={() => setIsLegendOpen(false)}>
        {/* Speed Legend (Always available if flow is visible, but here we just show it) */}
        <h4
          style={{
            margin: "0 0 5px 0",
            color: "white",
            borderBottom: "1px solid #555",
            paddingBottom: "2px",
          }}
        >
          Traffic Speed (km/h)
        </h4>
        {legendData.map((item) => (
          <div key={item.speed} style={{ marginBottom: "3px" }}>
            <span
              style={{
                display: "inline-block",
                width: "15px",
                height: "15px",
                backgroundColor: item.color,
                marginRight: "5px",
                verticalAlign: "middle",
              }}
            ></span>
            <span>{item.speed}</span>
          </div>
        ))}

        {/* Weather Legends */}
        {Object.keys(weatherLegends).map((key) => {
          if (visibleLayers[key]) {
            const legend = weatherLegends[key];
            return (
              <div key={key} style={{ marginTop: "15px" }}>
                <h4
                  style={{
                    margin: "0 0 5px 0",
                    color: "white",
                    borderBottom: "1px solid #555",
                    paddingBottom: "2px",
                  }}
                >
                  {legend.title}
                </h4>
                <div
                  style={{
                    position: "relative",
                    height: "35px",
                    marginTop: "5px",
                    width: "200px",
                  }}
                >
                  {/* Gradient Bar */}
                  <div
                    style={{
                      height: "15px",
                      width: "100%",
                      background: legend.gradient,
                      borderRadius: "2px",
                      border: "1px solid #777",
                    }}
                  ></div>
                  {/* Ticks and Labels */}
                  {legend.ticks.map((tick, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "absolute",
                        left: `${tick.percent}%`,
                        top: "18px",
                        transform: "translateX(-50%)",
                        textAlign: "center",
                        width: "30px", // Ensure width for centering
                      }}
                    >
                      <div
                        style={{
                          width: "1px",
                          height: "3px",
                          background: "#aaa",
                          margin: "0 auto 2px auto",
                        }}
                      ></div>
                      <div style={{ fontSize: "9px", color: "#ddd" }}>
                        {tick.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }
  return (
    <button
      style={closedStyle}
      onClick={() => setIsLegendOpen(true)}
      title="Show Legend"
    >
      <MdLegendToggle size={20} />
    </button>
  );
};

// --- カーソル座標表示コンポーネント ---
const CursorCoordinates = ({
  coords,
}: {
  coords: { lng: number; lat: number } | null;
}) => {
  if (!coords) return null;
  const toDegMin = (decimal: number, isLat: boolean) => {
    const degrees = Math.floor(Math.abs(decimal));
    const minutes = ((Math.abs(decimal) - degrees) * 60).toFixed(2);
    const direction = isLat
      ? decimal >= 0
        ? "N"
        : "S"
      : decimal >= 0
        ? "E"
        : "W";
    return `${degrees}° ${String(minutes).padStart(5, "0")} ${direction}`;
  };
  return (
    <div
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "white",
        padding: "3px 8px",
        borderRadius: "3px",
        zIndex: 1,
        fontFamily: "sans-serif",
        fontSize: "11px",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        height: "fit-content",
        alignSelf: "center",
      }}
    >
      <FaGlobeAmericas size={20} />
      <div style={{ lineHeight: "1.3" }}>
        <div style={{ textAlign: "right" }}>{toDegMin(coords.lat, true)}</div>
        <div style={{ textAlign: "right" }}>{toDegMin(coords.lng, false)}</div>
        <div style={{ fontSize: "10px", color: "#ccc" }}>
          ({coords.lat.toFixed(6)}, {coords.lng.toFixed(6)})
        </div>
      </div>
    </div>
  );
};

// --- ベースマップスタイル定義 ---
type BaseMapStyleKey = "positron" | "darkmatter" | "osm-standard" | "satellite";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";
const baseMapUrls: Record<BaseMapStyleKey, string> = {
  positron: `${apiBaseUrl}/api/map/style.json`,
  darkmatter: `${apiBaseUrl}/api/map/style-dark.json`,
  "osm-standard": `${apiBaseUrl}/api/map/style-osm-standard.json`,
  satellite: `${apiBaseUrl}/api/map/style-satellite.json`,
};

// --- 共通ボタンスタイル (ダークテーマ) ---
const controlButtonStyle: React.CSSProperties = {
  backgroundColor: "#333",
  color: "white",
  border: "1px solid #555",
  borderTop: "none",
  padding: "5px",
  cursor: "pointer",
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

// --- ベースマップ切り替えボタンコンポーネント ---
interface BaseMapSwitcherProps {
  currentStyle: BaseMapStyleKey;
  onChangeStyle: (styleKey: BaseMapStyleKey) => void;
}
const BaseMapSwitcher: React.FC<BaseMapSwitcherProps> = ({
  currentStyle,
  onChangeStyle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const handleSelectStyle = (styleKey: BaseMapStyleKey) => {
    onChangeStyle(styleKey);
    setIsMenuOpen(false);
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{
          ...controlButtonStyle,
          borderTop: "1px solid #555",
          borderRadius: "4px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
        title="Change map style"
      >
        <LuMap size={20} />
      </button>
      {isMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: "0",
            right: "40px",
            backgroundColor: "rgba(30,30,30,0.8)",
            color: "white",
            border: "1px solid #555",
            padding: "10px",
            borderRadius: "5px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            width: "120px",
            zIndex: 2,
          }}
        >
          <h4
            style={{
              margin: "0 0 8px 0",
              fontSize: "14px",
              borderBottom: "1px solid #555",
              paddingBottom: "4px",
              color: "white",
            }}
          >
            Map type
          </h4>
          {(Object.keys(baseMapUrls) as BaseMapStyleKey[]).map((key) => {
            const label =
              key === "positron"
                ? "Light"
                : key === "darkmatter"
                  ? "Dark"
                  : key === "osm-standard"
                    ? "OSM"
                    : key === "satellite"
                      ? "Satellite"
                      : key;
            return (
              <label
                key={key}
                style={{
                  display: "block",
                  cursor: "pointer",
                  padding: "4px 0",
                  color: "white",
                  fontSize: "13px",
                }}
              >
                <input
                  type="radio"
                  name="base-map-style"
                  checked={currentStyle === key}
                  onChange={() => handleSelectStyle(key)}
                  style={{ marginRight: "8px", accentColor: "white" }}
                />
                {label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- レイヤー切り替えパネル ---
interface LayerMenuPanelProps {
  isFlowVisible: boolean;
  onToggleFlow: () => void;
  isIncidentsVisible: boolean;
  onToggleIncidents: () => void;
  selectedRoadTypes: Set<string>;
  onToggleRoadType: (id: string) => void;
  weatherLayerVisibility: { [key: string]: boolean };
  onToggleWeatherLayer: (id: string) => void;
}
const LayerMenuPanel: React.FC<LayerMenuPanelProps> = ({
  isFlowVisible,
  onToggleFlow,
  isIncidentsVisible,
  onToggleIncidents,
  selectedRoadTypes,
  onToggleRoadType,
  weatherLayerVisibility,
  onToggleWeatherLayer,
}) => (
  <div
    style={{
      position: "absolute",
      top: "0",
      right: "40px",
      backgroundColor: "rgba(30,30,30,0.8)",
      color: "white",
      border: "1px solid #555",
      padding: "10px",
      borderRadius: "5px",
      zIndex: 1,
      width: "180px",
      boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
      fontFamily: "sans-serif",
      fontSize: "12px",
      maxHeight: "80vh",
      overflowY: "auto",
    }}
  >
    <h4
      style={{
        margin: "0 0 8px 0",
        fontSize: "14px",
        borderBottom: "1px solid #555",
        paddingBottom: "4px",
        color: "white",
      }}
    >
      Layers
    </h4>
    <label
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        color: "white",
      }}
    >
      <input
        type="checkbox"
        checked={isIncidentsVisible}
        onChange={onToggleIncidents}
        style={{ marginRight: "5px", accentColor: "white" }}
      />
      Traffic Incidents
    </label>
    <label
      style={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        marginTop: "5px",
        color: "white",
      }}
    >
      <input
        type="checkbox"
        checked={isFlowVisible}
        onChange={onToggleFlow}
        style={{ marginRight: "5px", accentColor: "white" }}
      />
      Traffic Flow
    </label>
    <div style={{ paddingLeft: "20px", marginTop: "5px" }}>
      <h5
        style={{
          margin: "5px 0 5px 0",
          fontSize: "13px",
          borderBottom: "1px solid #444",
          paddingBottom: "3px",
          color: isFlowVisible ? "white" : "#888",
        }}
      >
        Road Types
      </h5>
      {roadTypeData.map((rt) => (
        <label
          key={rt.id}
          style={{
            cursor: isFlowVisible ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            marginTop: "4px",
            color: isFlowVisible ? "white" : "#888",
            fontSize: "12px",
          }}
        >
          <input
            type="checkbox"
            checked={selectedRoadTypes.has(rt.id)}
            onChange={() => onToggleRoadType(rt.id)}
            disabled={!isFlowVisible}
            style={{ marginRight: "5px", accentColor: "white" }}
          />
          {rt.label}
        </label>
      ))}
    </div>
    {/*
    <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
      <h5 style={{
        margin: '5px 0 5px 0', fontSize: '13px', borderBottom: '1px solid #444',
        paddingBottom: '3px', color: 'white',
      }}>
        OpenWeatherMap
      </h5>
      {weatherLayers.map((layer) => (
        <label key={layer.id} style={{
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', marginTop: '4px', color: 'white',
          fontSize: '12px'
        }}>
          <input
            type="checkbox" checked={weatherLayerVisibility[layer.id]}
            onChange={() => onToggleWeatherLayer(layer.id)}
            style={{ marginRight: '5px', accentColor: 'white' }}
          />
          {layer.label}
        </label>
      ))}
    </div>
    */}
    <div style={{ paddingLeft: "20px", marginTop: "10px" }}>
      <h5
        style={{
          margin: "5px 0 5px 0",
          fontSize: "13px",
          borderBottom: "1px solid #444",
          paddingBottom: "3px",
          color: "white",
        }}
      >
        Weather {/* WeatherAPI.com */}
      </h5>
      <label
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          marginTop: "4px",
          color: "white",
          fontSize: "12px",
        }}
      >
        <input
          type="checkbox"
          checked={weatherLayerVisibility["wa-alerts"]}
          onChange={() => onToggleWeatherLayer("wa-alerts")}
          style={{ marginRight: "5px", accentColor: "white" }}
        />
        Weather Alerts (Center)
      </label>
      {weatherApiLayers.map((layer) => (
        <label
          key={layer.id}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            marginTop: "4px",
            color: "white",
            fontSize: "12px",
          }}
        >
          <input
            type="checkbox"
            checked={weatherLayerVisibility[layer.id]}
            onChange={() => onToggleWeatherLayer(layer.id)}
            style={{ marginRight: "5px", accentColor: "white" }}
          />
          {layer.label}
        </label>
      ))}
    </div>
    {/*
    <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
      <h5 style={{
        margin: '5px 0 5px 0', fontSize: '13px', borderBottom: '1px solid #444',
        paddingBottom: '3px', color: 'white',
      }}>
        Tomorrow.io
      </h5>
      {tomorrowIoLayers.map((layer) => (
        <label key={layer.id} style={{
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', marginTop: '4px', color: 'white',
          fontSize: '12px'
        }}>
          <input
            type="checkbox" checked={weatherLayerVisibility[layer.id]}
            onChange={() => onToggleWeatherLayer(layer.id)}
            style={{ marginRight: '5px', accentColor: 'white' }}
          />
          {layer.label}
        </label>
      ))}
    </div>
    */}
  </div>
);

// --- サイドナビゲーション用コンポーネント ---
const navIconStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "10px 16px",
  cursor: "pointer",
  color: "#eee",
  borderRadius: "4px",
  margin: "5px 0",
};
const navIconHoverStyle: React.CSSProperties = {
  backgroundColor: "#444",
  color: "white",
};
const NavItem = ({
  icon,
  text,
  isOpen,
}: {
  icon: React.ReactNode;
  text: string;
  isOpen: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      style={{
        ...navIconStyle,
        ...(isHovered ? navIconHoverStyle : {}),
        justifyContent: isOpen ? "flex-start" : "center",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={!isOpen ? text : undefined}
    >
      {icon}
      {isOpen && (
        <span
          style={{ marginLeft: "12px", fontSize: "14px", whiteSpace: "nowrap" }}
        >
          {text}
        </span>
      )}
    </div>
  );
};
const PinButton = ({
  isPinned,
  onClick,
}: {
  isPinned: boolean;
  onClick: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const pinStyle: React.CSSProperties = {
    cursor: "pointer",
    color: isHovered ? "white" : "#999",
    transition: "color 0.1s ease",
    padding: "5px",
  };
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={isPinned ? "Unpin menu" : "Pin menu"}
      style={pinStyle}
    >
      {isPinned ? <BsPinFill size={18} /> : <BsPinAngle size={18} />}
    </div>
  );
};
const SideNavbar = ({
  isOpen,
  isPinned,
  onPinToggle,
  onHoverEnter,
  onHoverLeave,
}: {
  isOpen: boolean;
  isPinned: boolean;
  onPinToggle: () => void;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
}) => {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        width: isOpen ? "220px" : "52px",
        backgroundColor: "#222",
        color: "white",
        zIndex: 1003,
        display: "flex",
        flexDirection: "column",
        padding: "10px 0",
        transition: "width 0.2s ease-in-out",
        boxShadow: "2px 0 5px rgba(0,0,0,0.3)",
        fontFamily: "sans-serif",
      }}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      {/* Top Section */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 16px",
            height: "40px",
            marginBottom: "10px",
          }}
        >
          <GiHorizonRoad size={isOpen ? 28 : 20} />
          {isOpen && (
            <div
              style={{ marginLeft: "10px", flexGrow: 1, overflow: "hidden" }}
            >
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "white",
                  whiteSpace: "nowrap",
                }}
              >
                Real-time Traffic
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "white",
                  whiteSpace: "nowrap",
                  display: "block",
                }}
              >
                Flow Monitoring
              </span>
            </div>
          )}
          {isOpen && <PinButton isPinned={isPinned} onClick={onPinToggle} />}
        </div>
      </div>
      {/* Bottom Section */}
      <div style={{ position: "absolute", bottom: "20px", width: "100%" }}>
        <NavItem
          icon={<MdNotifications size={20} />}
          text="Notifications"
          isOpen={isOpen}
        />
        <NavItem icon={<LuLogIn size={20} />} text="Login" isOpen={isOpen} />
        <NavItem
          icon={<LuSettings size={20} />}
          text="Settings"
          isOpen={isOpen}
        />
      </div>
    </div>
  );
};

// --- 検索バーコンポーネント ---
interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: (query: string) => void;
}
const SearchBar: React.FC<SearchBarProps> = ({ query, setQuery, onSearch }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };
  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: "rgba(30, 30, 30, 0.8)",
        border: "1px solid #555",
        borderRadius: "4px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        padding: "2px",
      }}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search location..."
        style={{
          backgroundColor: "transparent",
          border: "none",
          outline: "none",
          color: "white",
          padding: "8px 10px",
          fontSize: "14px",
          width: "300px",
        }}
      />
      <button
        type="submit"
        style={{
          background: "#444",
          border: "none",
          borderRadius: "4px",
          color: "white",
          padding: "6px 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
        }}
        title="Search"
      >
        <FaSearchLocation size={20} />
      </button>
    </form>
  );
};

// --- ツールチップの内容生成ロジック ---

// --- 日付フォーマット用ヘルパー関数 ---
const formatDateUTC = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return isoString;
    }
    return date.toLocaleString("ja-JP", { timeZone: "UTC", hour12: false });
  } catch (e) {
    return isoString;
  }
};

// --- 閉じるボタン ---
const CloseButton = ({
  onClick,
  color = "black",
}: {
  onClick: () => void;
  color?: string;
}) => (
  <FaWindowClose
    size={16}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      position: "absolute",
      top: "5px",
      right: "5px",
      cursor: "pointer",
      color: color,
    }}
    onMouseEnter={(e) =>
      (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.2)")
    }
    onMouseLeave={(e) =>
      (e.currentTarget.style.backgroundColor = "transparent")
    }
  />
);

// --- ホバー用: 交通流 (Flow) ---
const formatFlowContent = (properties: any): React.ReactNode => {
  const style: React.CSSProperties = {
    fontFamily: "sans-serif",
    fontSize: "12px",
    maxWidth: "250px",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "white",
    padding: "5px 8px",
    borderRadius: "3px",
    position: "relative",
  };
  const title = (
    <strong
      style={{
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        marginBottom: "5px",
      }}
    >
      <FaCar
        size={16}
        style={{ verticalAlign: "middle", marginRight: "5px" }}
      />{" "}
      Traffic Flow
    </strong>
  );
  if (!properties)
    return (
      <div style={style}>
        {title}
        <br />
        (No data)
      </div>
    );

  const internalKeys = new Set([
    "$type",
    "layer",
    "source",
    "sourceLayer",
    "state",
    "tile",
  ]);
  const lines: React.ReactNode[] = [];
  const keys = Object.keys(properties).sort();
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(properties, key) &&
      !internalKeys.has(key)
    ) {
      const value = properties[key];
      if (value !== undefined && value !== null) {
        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        let displayValue = String(value);
        if (key === "absolute_speed") {
          displayValue = `${String(value)} km/h`;
        }
        lines.push(
          <span style={{ overflowWrap: "break-word" }} key={key}>
            <strong>{formattedKey}:</strong> {displayValue}
          </span>,
        );
      }
    }
  }
  const content =
    lines.length === 0 ? (
      "(No detailed info available)"
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {lines}
      </div>
    );
  return (
    <div style={style}>
      {title}
      {content}
    </div>
  );
};

// --- ホバー用: インシデント (Incident) ---
const formatIncidentContent = (properties: any): React.ReactNode => {
  const style: React.CSSProperties = {
    fontFamily: "sans-serif",
    fontSize: "12px",
    maxWidth: "250px",
    backgroundColor: "rgba(255,249,196,0.9)",
    color: "black",
    padding: "5px 8px",
    borderRadius: "3px",
    border: "1px solid #E0E0E0",
    position: "relative",
  };
  const title = (
    <strong
      style={{
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        marginBottom: "5px",
      }}
    >
      <LuTriangleAlert
        size={16}
        style={{ verticalAlign: "middle", marginRight: "5px" }}
      />{" "}
      Traffic Incident
    </strong>
  );
  if (!properties)
    return (
      <div style={style}>
        {title}
        <br />
        (No data)
      </div>
    );

  const iconCategoryMap: { [key: number]: string } = {
    0: "Unknown",
    1: "Accident",
    2: "Fog",
    3: "Dangerous Conditions",
    4: "Rain",
    5: "Ice",
    6: "Jam",
    7: "Lane Closed",
    8: "Road Closed",
    9: "Road Works",
    10: "Wind",
    11: "Flooding",
    14: "Broken Down Vehicle",
  };
  const internalKeys = new Set([
    "$type",
    "layer",
    "source",
    "sourceLayer",
    "state",
    "tile",
  ]);
  const dateKeys = new Set(["end_date", "last_report_time"]);
  const lines: React.ReactNode[] = [];
  const keys = Object.keys(properties).sort();
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(properties, key) &&
      !internalKeys.has(key)
    ) {
      const value = properties[key];
      if (value !== undefined && value !== null) {
        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        let displayValue = String(value);
        if (key === "delay") {
          displayValue = `${String(value)} s`;
        } else if (key === "magnitude_of_delay") {
          let magnitudeText = "Unknown";
          switch (Number(value)) {
            case 1:
              magnitudeText = "Minor";
              break;
            case 2:
              magnitudeText = "Moderate";
              break;
            case 3:
              magnitudeText = "Major";
              break;
            case 4:
              magnitudeText = "Closed";
              break;
          }
          displayValue = `${String(value)}. ${magnitudeText}`;
        } else if (key.startsWith("icon_category")) {
          const numericValue = Number(value);
          const description = iconCategoryMap[numericValue];
          displayValue = description
            ? `${String(value)}. ${description}`
            : `${String(value)}. Other`;
        } else if (
          dateKeys.has(key) &&
          typeof value === "string" &&
          value.endsWith("Z")
        ) {
          displayValue = formatDateUTC(value);
        }
        lines.push(
          <span style={{ overflowWrap: "break-word" }} key={key}>
            <strong>{formattedKey}:</strong> {displayValue}
          </span>,
        );
      }
    }
  }
  const content =
    lines.length === 0 ? (
      "(No detailed info available)"
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {lines}
      </div>
    );
  return (
    <div style={style}>
      {title}
      {content}
    </div>
  );
};

// --- クリック用: ローディング中 ---
const formatLoadingContent = (
  isPinned: boolean,
  onClose: () => void,
): React.ReactNode => (
  <div
    style={{
      fontFamily: "sans-serif",
      fontSize: "12px",
      maxWidth: "250px",
      backgroundColor: "rgba(255,255,255,0.9)",
      color: "black",
      padding: "10px 15px",
      borderRadius: "3px",
      border: "1px solid #E0E0E0",
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}
  >
    {isPinned && <CloseButton onClick={onClose} />}
    <FaSpinner />
    Loading details...
  </div>
);

// --- クリック用: エラー発生時 ---
const formatErrorContent = (
  error: any,
  isPinned: boolean,
  onClose: () => void,
): React.ReactNode => {
  // エラーメッセージを抽出する
  let errorMessage = "Failed to fetch details.";
  try {
    if (error?.data?.detail) {
      if (typeof error.data.detail === "string") {
        errorMessage = error.data.detail; // "Not Found" など
      } else if (error.data.detail.detailedError?.message) {
        // TomTomのネストされたエラー: {"detail": {"detailedError": {"message": "..."}}}
        errorMessage = error.data.detail.detailedError.message;
      } else if (typeof error.data.detail === "object") {
        // Reactクラッシュ回避: オブジェクトを文字列に
        errorMessage = JSON.stringify(error.data.detail);
      }
    } else if (error?.message) {
      errorMessage = error.message; // ネットワークエラーなど
    }
  } catch (e) {
    errorMessage =
      "An unknown error occurred while formatting the error message.";
  }

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        fontSize: "12px",
        maxWidth: "250px",
        backgroundColor: "rgba(255,220,220,0.9)",
        color: "black",
        padding: "10px 15px",
        borderRadius: "3px",
        border: "1px solid #E0E0E0",
        position: "relative",
      }}
    >
      {isPinned && <CloseButton onClick={onClose} />}
      <strong
        style={{
          color: "#D8000C",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <BiErrorAlt /> Error
      </strong>
      <span
        style={{
          display: "block",
          marginTop: "5px",
          overflowWrap: "break-word",
        }}
      >
        {errorMessage} {/* 安全に抽出したメッセージを表示 */}
      </span>
    </div>
  );
};

// --- クリック用: 交通流詳細 (Flow Details) ---
const formatFlowDetailsContent = (
  tileProps: any,
  apiData: any,
  isPinned: boolean,
  onClose: () => void,
): React.ReactNode => {
  const style: React.CSSProperties = {
    fontFamily: "sans-serif",
    fontSize: "12px",
    maxWidth: "320px",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "white",
    padding: "5px 8px",
    borderRadius: "3px",
    position: "relative",
  };

  const title = (
    <strong
      style={{
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        marginBottom: "5px",
        paddingRight: "20px",
      }}
    >
      <FaCar
        size={16}
        style={{ verticalAlign: "middle", marginRight: "5px" }}
      />{" "}
      Flow Segment Details
    </strong>
  );

  // API (v4) からの詳細データを取得
  const segment = apiData?.flowSegmentData;

  // タイル情報の全キーを表示するロジック (既知のキーを除く)
  const internalKeys = new Set([
    "$type",
    "layer",
    "source",
    "sourceLayer",
    "state",
    "tile",
    "currentSpeed",
    "freeFlowSpeed",
    "currentTravelTime",
    "confidence",
    "road_category",
    "road_subcategory",
    "absolute_speed",
    "relative_speed",
    "free_flow_speed",
    "openlr",
  ]);
  const tileLines: React.ReactNode[] = [];
  const keys = Object.keys(tileProps).sort();
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(tileProps, key) &&
      !internalKeys.has(key)
    ) {
      const value = tileProps[key];
      if (value !== undefined && value !== null) {
        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        let displayValue = String(value);
        tileLines.push(
          <span style={{ overflowWrap: "break-word" }} key={key}>
            <strong>{formattedKey}:</strong> {displayValue}
          </span>,
        );
      }
    }
  }

  return (
    <div style={style}>
      {isPinned && <CloseButton onClick={onClose} color="white" />}
      {title}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          maxHeight: "300px",
          overflowY: "auto",
          paddingRight: "5px",
        }}
      >
        {/* --- Orbis Map (Tile) Data --- */}
        <div style={{ fontSize: "11px", color: "#aaa", marginTop: "5px" }}>
          [ Orbis Material Attributes ]
        </div>
        <span>
          <strong>Road Category:</strong> {tileProps.road_category || "N/A"}
        </span>
        <span>
          <strong>Absolute Speed:</strong>{" "}
          {tileProps.absolute_speed !== undefined
            ? `${String(tileProps.absolute_speed)} km/h`
            : "N/A"}
        </span>
        {tileProps.free_flow_speed !== undefined && (
          <span>
            <strong>Free Flow Speed:</strong> {tileProps.free_flow_speed} km/h
          </span>
        )}
        {tileProps.relative_speed !== undefined && (
          <span>
            <strong>Relative Speed:</strong>{" "}
            {(Number(tileProps.relative_speed) * 100).toFixed(1)} %
          </span>
        )}
        {tileProps.confidence !== undefined && (
          <span>
            <strong>Confidence:</strong> {tileProps.confidence}
          </span>
        )}
        {tileLines}

        <hr style={{ border: "none", borderTop: "1px solid #555" }} />

        {/* --- Traffic API (Legacy/v4) Data --- */}
        <div style={{ fontSize: "11px", color: "#aaa" }}>
          [ Traffic API v4 (Legacy) ]
        </div>
        {!segment ? (
          <span style={{ fontStyle: "italic", fontSize: "11px" }}>
            (API Data not available in this region)
          </span>
        ) : (
          <>
            <span>
              <strong>Current Speed:</strong> {segment.currentSpeed ?? "N/A"} km/h
            </span>
            <span>
              <strong>Free Flow Speed:</strong> {segment.freeFlowSpeed ?? "N/A"}{" "}
              km/h
            </span>
            <span>
              <strong>Current Travel Time:</strong>{" "}
              {segment.currentTravelTime ?? "N/A"} sec
            </span>
            <span>
              <strong>Confidence:</strong> {segment.confidence ?? "N/A"}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// --- クリック用: インシデント詳細 (Incident Details) ---
const formatIncidentDetailsContent = (
  tileProps: any,
  apiData: any,
  isPinned: boolean,
  onClose: () => void,
): React.ReactNode => {
  const style: React.CSSProperties = {
    fontFamily: "sans-serif",
    fontSize: "12px",
    maxWidth: "300px",
    backgroundColor: "rgba(255,249,196,0.9)",
    color: "black",
    padding: "5px 8px",
    borderRadius: "3px",
    border: "1px solid #E0E0E0",
    position: "relative",
  };
  const title = (
    <strong
      style={{
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        marginBottom: "5px",
        paddingRight: "20px",
      }}
    >
      <LuTriangleAlert
        size={16}
        style={{ verticalAlign: "middle", marginRight: "5px" }}
      />{" "}
      Incident Details
    </strong>
  );

  // API (v5) からの詳細データを取得
  const detail = apiData?.incidents?.[0]?.properties;

  // タイル情報の全キーを表示するロジック (APIに存在するキーを除く)
  const iconCategoryMap: { [key: number]: string } = {
    0: "Unknown",
    1: "Accident",
    2: "Fog",
    3: "Dangerous Conditions",
    4: "Rain",
    5: "Ice",
    6: "Jam",
    7: "Lane Closed",
    8: "Road Closed",
    9: "Road Works",
    10: "Wind",
    11: "Flooding",
    14: "Broken Down Vehicle",
  };
  // APIと重複する可能性のあるキーを除外
  const internalKeys = new Set([
    "$type",
    "layer",
    "source",
    "sourceLayer",
    "state",
    "tile",
    "id",
    "from",
    "to",
    "length",
    "delay",
    "startTime",
    "endTime",
    "end_date",
    "last_report_time", // APIの startTime/endTime と重複するため
    "magnitude_of_delay",
  ]);
  const dateKeys = new Set(["last_report_time"]); // (startTime/endTime は除外)
  const tileLines: React.ReactNode[] = [];
  const keys = Object.keys(tileProps).sort();
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(tileProps, key) &&
      !internalKeys.has(key)
    ) {
      const value = tileProps[key];
      if (value !== undefined && value !== null) {
        const formattedKey = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        let displayValue = String(value);
        if (key === "delay") {
          // (APIと重複するが、名前が同じなのでそのまま表示)
          displayValue = `${String(value)} s`;
        } else if (key === "magnitude_of_delay") {
          let magnitudeText = "Unknown";
          switch (Number(value)) {
            case 1:
              magnitudeText = "Minor";
              break;
            case 2:
              magnitudeText = "Moderate";
              break;
            case 3:
              magnitudeText = "Major";
              break;
            case 4:
              magnitudeText = "Closed";
              break;
          }
          displayValue = `${String(value)}. ${magnitudeText}`;
        } else if (key.startsWith("icon_category")) {
          const numericValue = Number(value);
          const description = iconCategoryMap[numericValue];
          displayValue = description
            ? `${String(value)}. ${description}`
            : `${String(value)}. Other`;
        } else if (
          dateKeys.has(key) &&
          typeof value === "string" &&
          value.endsWith("Z")
        ) {
          displayValue = formatDateUTC(value);
        }
        tileLines.push(
          <span style={{ overflowWrap: "break-word" }} key={key}>
            <strong>{formattedKey}:</strong> {displayValue}
          </span>,
        );
      }
    }
  }

  return (
    <div style={style}>
      {isPinned && <CloseButton onClick={onClose} />}
      {title}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          maxHeight: "200px",
          overflowY: "auto",
          paddingRight: "5px",
        }}
      >
        {/* タイル データを先に表示 */}
        <span style={{ overflowWrap: "break-word" }}>
          <strong>ID:</strong> {tileProps.id || "N/A"}
        </span>
        <span style={{ overflowWrap: "break-word" }}>
          <strong>Description:</strong> {tileProps.description || "N/A"}
        </span>
        {tileLines}

        <hr style={{ border: "none", borderTop: "1px solid #ccc" }} />

        {/* API v5 データ */}
        {detail ? (
          <>
            <span>
              <strong>From:</strong> {detail.from ?? "N/A"}
            </span>
            <span>
              <strong>To:</strong> {detail.to ?? "N/A"}
            </span>
            <span>
              <strong>Length:</strong>{" "}
              {detail.length ? `${detail.length} m` : "N/A"}
            </span>
            <span>
              <strong>Magnitude:</strong> {detail.magnitudeOfDelay ?? "N/A"}
            </span>
            <span>
              <strong>Delay:</strong>{" "}
              {detail.delay ? `${detail.delay} sec` : "N/A"}
            </span>
            <span>
              <strong>Start Time:</strong>{" "}
              {detail.startTime ? formatDateUTC(detail.startTime) : "N/A"}
            </span>
            <span>
              <strong>End Time:</strong>{" "}
              {detail.endTime ? formatDateUTC(detail.endTime) : "N/A"}
            </span>
          </>
        ) : (
          <span>No specific (v5) details found.</span>
        )}
      </div>
    </div>
  );
};


// --- メインコンポーネント ---
function MapDashboard() {
  const [viewState, setViewState] =
    useState<Partial<ViewState>>(INITIAL_VIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [currentMapStyleKey, setCurrentMapStyleKey] =
    useState<BaseMapStyleKey>("positron");
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number } | null>(
    null,
  );
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [isClickTooltipPinned, setIsClickTooltipPinned] = useState(false);
  const [isFlowVisible, setIsFlowVisible] = useState(true);
  const [isIncidentsVisible, setIsIncidentsVisible] = useState(true);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [selectedRoadTypes, setSelectedRoadTypes] = useState<Set<string>>(
    new Set(
      roadTypeData
        .filter((rt) => rt.id !== "tertiary")
        .map((rt) => rt.id as string),
    ),
  );
  const [weatherLayerVisibility, setWeatherLayerVisibility] = useState<{
    [key: string]: boolean;
  }>({
    /*
    clouds: false,
    precipitation: false,
    pressure: false,
    wind: false,
    temp: false,
    */
    "wa-temp": false,
    "wa-precip": false,
    "wa-wind": false,
    "wa-pressure": false,
    "wa-alerts": false,
    /*
    'ti-temperature': false,
    'ti-windSpeed': false,
    'ti-pressureSeaLevel': false,
    'ti-precipitationType': false,
    'ti-precipitationIntensity': false,
    'ti-precipitationProbability': false,
    'ti-rainIntensity': false,
    'ti-rainAccumulation': false,
    'ti-thunderstormProbability': false,
    'ti-snowIntensity': false,
    'ti-snowAccumulation': false,
    'ti-snowDepth': false,
    'ti-visibility': false,
    */
  });
  const [alertsData, setAlertsData] = useState<any>(null);
  const [expandedAlertIndices, setExpandedAlertIndices] = useState<Set<number>>(
    new Set(),
  );
  // const [currentIsoTime, setCurrentIsoTime] = useState(new Date().toISOString());
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHoverOpen, setIsSidebarHoverOpen] = useState(false);
  const isSidebarOpen = isSidebarPinned || isSidebarHoverOpen;
  const [searchQuery, setSearchQuery] = useState("");
  const mapStyleUrl = baseMapUrls[currentMapStyleKey];

  const handleMapMove = useCallback((e: any) => {
    if (e.viewState) {
      setViewState(e.viewState);
    }
  }, []);

  const handleMapIdle = useCallback(() => {
    //
  }, []);

  // --- 時刻更新 (Tomorrow.io用 - コメントアウト) ---
  /*
  useEffect(() => {
      // 15分ごとに時刻を更新してタイルをリフレッシュ
      const interval = setInterval(() => {
          setCurrentIsoTime(new Date().toISOString());
      }, 15 * 60 * 1000);
      return () => clearInterval(interval);
  }, []);
  */

  // --- Alerts 取得ロジック ---
  useEffect(() => {
    if (!weatherLayerVisibility["wa-alerts"]) {
      setAlertsData(null);
      return;
    }
    const fetchAlerts = async () => {
      const center = mapRef.current?.getMap().getCenter();
      if (!center) return;
      try {
        const q = `${center.lat},${center.lng}`;
        const data = (await api.getWeatherAlerts(q)) as any;
        if (
          data &&
          data.alerts &&
          data.alerts.alert &&
          data.alerts.alert.length > 0
        ) {
          setAlertsData(data.alerts.alert);
        } else {
          setAlertsData([]);
        }
      } catch (e) {
        console.error("Failed to fetch alerts", e);
      }
    };
    // 初回と、マップ移動終了時に取得
    fetchAlerts();
    const map = mapRef.current?.getMap();
    if (map) {
      map.on("moveend", fetchAlerts);
    }
    return () => {
      if (map) map.off("moveend", fetchAlerts);
    };
  }, [weatherLayerVisibility["wa-alerts"]]);

  // --- ホバー時の処理 ---
  const handleMouseMove = useCallback(
    (event: maplibregl.MapLayerMouseEvent) => {
      if (isClickTooltipPinned) {
        return;
      }
      setCursorCoords(event.lngLat);
      const { features, point } = event;
      const flowFeature =
        features && features.find((f) => f.layer.id === "tomtom-traffic-layer");
      const incidentFeature =
        features &&
        features.find(
          (f) =>
            f.layer.id === "tomtom-traffic-incident-layer-outline" ||
            f.layer.id === "tomtom-traffic-incident-layer-dash",
        );
      const map = mapRef.current?.getMap();
      if (map)
        map.getCanvas().style.cursor =
          flowFeature || incidentFeature ? "pointer" : "";

      let content: React.ReactNode = null;
      if (incidentFeature) {
        content = formatIncidentContent(incidentFeature.properties);
      } else if (flowFeature) {
        content = formatFlowContent(flowFeature.properties);
      }

      if (content) {
        setHoverInfo({ x: point.x, y: point.y });
        setTooltipContent(content);
      } else {
        setHoverInfo(null);
        setTooltipContent(null);
      }
    },
    [isClickTooltipPinned],
  );

  // --- 地図からマウスが離れた時の処理 ---
  const handleMouseOut = useCallback(() => {
    setCursorCoords(null);
  }, []);

  // --- クリック時の処理 (v4 API 呼び出し) ---
  const handleClick = useCallback(
    async (event: maplibregl.MapLayerMouseEvent) => {
      const { features, lngLat, point, target: map } = event; // map を event から取得

      const handleCloseTooltip = () => {
        setIsClickTooltipPinned(false);
        setTooltipContent(null);
      };

      const flowFeature =
        features && features.find((f) => f.layer.id === "tomtom-traffic-layer");
      const incidentFeature =
        features &&
        features.find(
          (f) =>
            f.layer.id === "tomtom-traffic-incident-layer-outline" ||
            f.layer.id === "tomtom-traffic-incident-layer-dash",
        );

      let featureToShow = null;
      let apiCallType: "incident" | "flow" | null = null;

      if (incidentFeature) {
        featureToShow = incidentFeature;
        apiCallType = "incident";
      } else if (flowFeature) {
        featureToShow = flowFeature;
        apiCallType = "flow";
      }

      if (featureToShow && apiCallType) {
        // 1. ピン留めし、ローディング表示
        setHoverInfo({ x: point.x, y: point.y });
        setTooltipContent(formatLoadingContent(true, handleCloseTooltip));
        setIsClickTooltipPinned(true);

        try {
          if (apiCallType === "incident") {
            const incidentId = featureToShow.properties?.id;
            if (!incidentId)
              throw new Error("Incident ID not found in tile data.");

            // 2. Incident API 呼び出し
            const details = await api.getIncidentDetails(incidentId);

            // 3. 成功：詳細コンテンツを表示
            setTooltipContent(
              formatIncidentDetailsContent(
                featureToShow.properties,
                details,
                true,
                handleCloseTooltip,
              ),
            );
          } else if (apiCallType === "flow") {
            const zoom = Math.floor(map.getZoom());
            try {
              const details = await api.getFlowSegmentData(
                zoom,
                lngLat.lat,
                lngLat.lng,
              );
              setTooltipContent(
                formatFlowDetailsContent(
                  featureToShow.properties,
                  details,
                  true,
                  handleCloseTooltip,
                ),
              );
            } catch (apiError) {
              console.warn(
                "Flow Segment API failed. Falling back to tile data.",
                apiError,
              );
              // API呼び出しに失敗しても、タイルデータのみで詳細を表示
              setTooltipContent(
                formatFlowDetailsContent(
                  featureToShow.properties,
                  null, // APIデータなし
                  true,
                  handleCloseTooltip,
                ),
              );
            }
          }
        } catch (error: any) {
          // 4. 失敗：エラーコンテンツを表示
          console.error(`Failed to fetch ${apiCallType} details:`, error);
          setTooltipContent(
            formatErrorContent(error, true, handleCloseTooltip),
          );
        }
      } else {
        // 何もない場所をクリックしたら、ピン留めを解除
        setIsClickTooltipPinned(false);
        setTooltipContent(null);
      }
    },
    [],
  );

  // --- エラー表示の5秒タイマー ---
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // --- ツールチップの位置調整ロジック ---
  useEffect(() => {
    if (tooltipRef.current && hoverInfo && tooltipContent) {
      const tooltipElement = tooltipRef.current;
      const mapWrapper = tooltipElement.parentElement;
      if (!mapWrapper) return;
      requestAnimationFrame(() => {
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const tooltipHeight = tooltipRect.height;
        const tooltipWidth = tooltipRect.width;
        const tooltipOffset = 15;
        const wrapperRect = mapWrapper.getBoundingClientRect();
        let finalTop = hoverInfo.y + tooltipOffset;
        let finalLeft = hoverInfo.x + tooltipOffset;
        if (finalTop + tooltipHeight > wrapperRect.height - 30) {
          finalTop = hoverInfo.y - tooltipHeight - tooltipOffset;
        }
        if (finalTop < 10) {
          finalTop = 10;
        }
        if (finalLeft + tooltipWidth > wrapperRect.width - 10) {
          finalLeft = hoverInfo.x - tooltipWidth - tooltipOffset;
        }
        if (finalLeft < 10) {
          finalLeft = 10;
        }
        tooltipElement.style.top = `${finalTop}px`;
        tooltipElement.style.left = `${finalLeft}px`;
        tooltipElement.style.visibility = "visible";
      });
    } else if (tooltipRef.current) {
      tooltipRef.current.style.visibility = "hidden";
    }
  }, [hoverInfo, tooltipContent, isClickTooltipPinned]);

  // --- ホバー用ツールチップ ---
  const renderTooltip = () => {
    if (!tooltipContent) return null;
    const tooltipStyle: React.CSSProperties = {
      position: "absolute",
      zIndex: 1002,
      pointerEvents: isClickTooltipPinned ? "auto" : "none",
      transformOrigin: "top left",
      visibility: "hidden",
    };
    return (
      <div ref={tooltipRef} style={tooltipStyle}>
        {tooltipContent}
      </div>
    );
  };

  // --- フィルタリングと表示ロジック ---
  const applyFiltersAndVisibility = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (!map.isStyleLoaded() || !map.getLayer(layersToFilter[0])) {
      map.once("render", applyFiltersAndVisibility);
      return;
    }
    try {
      if (map.getLayer("tomtom-traffic-layer")) {
        map.setLayoutProperty(
          "tomtom-traffic-layer",
          "visibility",
          isFlowVisible ? "visible" : "none",
        );
      }
      const incidentLayerIds = [
        "tomtom-traffic-incident-layer-outline",
        "tomtom-traffic-incident-layer-dash",
      ];
      incidentLayerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(
            layerId,
            "visibility",
            isIncidentsVisible ? "visible" : "none",
          );
        }
      });
      let roadTypeFilter: any[] | null;
      if (selectedRoadTypes.size === 0) {
        roadTypeFilter = ["==", ["get", "road_category"], "___NONE___"];
      } else if (selectedRoadTypes.size === roadTypeData.length) {
        roadTypeFilter = null;
      } else {
        roadTypeFilter = [
          "in",
          ["get", "road_category"],
          ["literal", Array.from(selectedRoadTypes)],
        ];
      }
      layersToFilter.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setFilter(layerId, roadTypeFilter as any);
        } else {
          throw new Error(
            `Layer ${layerId} not found during filter application.`,
          );
        }
      });
    } catch (error) {
      map.off("render", applyFiltersAndVisibility);
      map.once("render", applyFiltersAndVisibility);
    }
  }, [isFlowVisible, isIncidentsVisible, selectedRoadTypes]);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && map.isStyleLoaded()) {
      applyFiltersAndVisibility();
    }
  }, [
    isFlowVisible,
    isIncidentsVisible,
    selectedRoadTypes,
    applyFiltersAndVisibility,
  ]);
  const handleStyleLoadOrChange = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      applyFiltersAndVisibility();
    }
  }, [applyFiltersAndVisibility]);

  // --- ズーム/ピッチ コントロール関数 ---
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const PITCH_LEVELS = [0, 30, 45, 60];
  const currentPitch = viewState.pitch || 0;
  const handlePitchUp = () => {
    const nextPitch = PITCH_LEVELS.find((p) => p > currentPitch);
    mapRef.current?.easeTo({
      pitch:
        nextPitch !== undefined
          ? nextPitch
          : PITCH_LEVELS[PITCH_LEVELS.length - 1],
    });
  };
  const handlePitchDown = () => {
    const prevPitch = [...PITCH_LEVELS].reverse().find((p) => p < currentPitch);
    mapRef.current?.easeTo({
      pitch: prevPitch !== undefined ? prevPitch : PITCH_LEVELS[0],
    });
  };
  const disabledControlButtonStyle: React.CSSProperties = {
    ...controlButtonStyle,
    cursor: "not-allowed",
    backgroundColor: "#222",
    color: "#777",
  };

  // --- 検索ハンドラ ---
  const handleSearch = async (query: string) => {
    setError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/geocode?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Location not found");
      }
      const data = await response.json();
      if (data.latitude && data.longitude) {
        await mapRef.current?.flyTo({
          center: [data.longitude, data.latitude],
          zoom: INITIAL_VIEW_STATE.zoom,
          pitch: 0,
          bearing: 0,
          essential: true,
        });
        setSearchQuery("");
      } else {
        throw new Error("Invalid coordinates received from server");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setError(err.message || "Failed to geocode location");
    }
  };

  // --- 道路種別 (Road Type) 切り替えハンドラ ---
  const handleToggleRoadType = (typeId: string) => {
    setSelectedRoadTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(typeId)) {
        newSet.delete(typeId);
      } else {
        newSet.add(typeId);
      }
      return newSet;
    });
  };

  const handleToggleWeatherLayer = (id: string) => {
    setWeatherLayerVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAlertExpand = (index: number) => {
    setExpandedAlertIndices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // --- レンダリング ---
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <SideNavbar
        isOpen={isSidebarOpen}
        isPinned={isSidebarPinned}
        onPinToggle={() => setIsSidebarPinned(!isSidebarPinned)}
        onHoverEnter={() => setIsSidebarHoverOpen(true)}
        onHoverLeave={() => setIsSidebarHoverOpen(false)}
      />
      <div
        style={{
          position: "relative",
          height: "100%",
          marginLeft: isSidebarPinned ? "220px" : "52px",
          transition: "margin-left 0.2s ease-in-out",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "5px",
          }}
        >
          <SearchBar
            query={searchQuery}
            setQuery={setSearchQuery}
            onSearch={handleSearch}
          />
          {error && (
            <div
              style={{
                backgroundColor: "rgba(255, 0, 0, 0.8)",
                color: "white",
                padding: "10px 15px",
                borderRadius: "5px",
                maxWidth: "400px",
                textAlign: "left",
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <BiErrorAlt size={20} />
              <span>{error}</span>
            </div>
          )}
        </div>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={handleMapMove}
          onIdle={handleMapIdle}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyleUrl}
          initialViewState={INITIAL_VIEW_STATE}
          interactiveLayerIds={layersToFilter}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseOut={handleMouseOut}
          onLoad={handleStyleLoadOrChange}
          onStyleData={handleStyleLoadOrChange}
        >
          <ScaleControl unit="metric" position="bottom-left" />
          {/*
            {weatherLayers.map(layer => (
              weatherLayerVisibility[layer.id] && (
                <Source key={layer.id} type="raster" tiles={[`${layer.url}${OWM_API_KEY}`]} tileSize={256}>
                  <Layer id={`weather-${layer.id}`} type="raster" paint={{ 'raster-opacity': 0.7 }} />
                </Source>
              )
            ))}
            */}
          {weatherApiLayers.map((layer) => {
            if (!weatherLayerVisibility[layer.id]) return null;
            const { date, hour } = getWeatherMapParams();
            const tileUrl = layer.url
              .replace("{date}", date)
              .replace("{hour}", hour);
            return (
              <Source
                key={layer.id}
                type="raster"
                tiles={[tileUrl]}
                tileSize={256}
                attribution='Powered by <a href="https://www.weatherapi.com/" title="Free Weather API">WeatherAPI.com</a>'
              >
                <Layer
                  id={`weather-api-${layer.id}`}
                  type="raster"
                  paint={{ "raster-opacity": 0.6 }}
                />
              </Source>
            );
          })}
          {/*
            {tomorrowIoLayers.map(layer => (
              weatherLayerVisibility[layer.id] && (
                <Source
                    key={layer.id}
                    type="raster"
                    tiles={[`https://api.tomorrow.io/v4/map/tile/{z}/{x}/{y}/${layer.field}/${currentIsoTime}.png?apikey=${TOMORROW_IO_API_KEY}`]}
                    tileSize={256}
                >
                  <Layer id={`tomorrow-io-${layer.id}`} type="raster" paint={{ 'raster-opacity': 0.6 }} />
                </Source>
              )
            ))}
            */}
        </Map>
        {renderTooltip()}
        {/* Alerts Overlay */}
        {weatherLayerVisibility["wa-alerts"] &&
          alertsData &&
          alertsData.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "60px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(255, 50, 50, 0.9)",
                color: "white",
                padding: "10px",
                borderRadius: "5px",
                zIndex: 1000,
                maxWidth: "80%",
                maxHeight: "200px",
                overflowY: "auto",
                boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                fontFamily: "sans-serif",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  fontWeight: "bold",
                  marginBottom: "5px",
                  borderBottom: "1px solid white",
                  paddingBottom: "3px",
                }}
              >
                Weather Alerts ({alertsData.length})
              </div>
              {alertsData.map((alert: any, idx: number) => {
                const isExpanded = expandedAlertIndices.has(idx);
                return (
                  <div
                    key={idx}
                    style={{
                      marginBottom: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid rgba(255,255,255,0.3)",
                      paddingBottom: "5px",
                    }}
                    onClick={() => toggleAlertExpand(idx)}
                  >
                    <div style={{ fontWeight: "bold" }}>{alert.headline}</div>
                    <div style={{ fontSize: "11px" }}>{alert.event}</div>
                    {alert.desc && (
                      <div
                        style={{
                          fontSize: "10px",
                          marginTop: "2px",
                          opacity: 0.9,
                        }}
                      >
                        {isExpanded
                          ? alert.desc
                          : `${alert.desc.substring(0, 100)}${alert.desc.length > 100 ? "..." : ""}`}
                        {alert.desc.length > 100 && (
                          <span
                            style={{
                              marginLeft: "5px",
                              textDecoration: "underline",
                              fontSize: "9px",
                              color: "#eee",
                            }}
                          >
                            {isExpanded ? "(Show less)" : "(Show more)"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        {weatherLayerVisibility["wa-alerts"] &&
          alertsData &&
          alertsData.length === 0 && (
            <div
              style={{
                position: "absolute",
                top: "60px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(50, 200, 50, 0.8)",
                color: "white",
                padding: "5px 10px",
                borderRadius: "5px",
                zIndex: 1000,
                fontFamily: "sans-serif",
                fontSize: "12px",
              }}
            >
              No Weather Alerts in this area
            </div>
          )}

        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <BaseMapSwitcher
            currentStyle={currentMapStyleKey}
            onChangeStyle={setCurrentMapStyleKey}
          />
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
              style={{
                ...controlButtonStyle,
                borderTop: "1px solid #555",
                borderRadius: "4px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
              title="Toggle layers"
            >
              <LuLayers size={20} />
            </button>
            {isLayerMenuOpen && (
              <LayerMenuPanel
                isFlowVisible={isFlowVisible}
                onToggleFlow={() => setIsFlowVisible(!isFlowVisible)}
                isIncidentsVisible={isIncidentsVisible}
                onToggleIncidents={() =>
                  setIsIncidentsVisible(!isIncidentsVisible)
                }
                selectedRoadTypes={selectedRoadTypes}
                onToggleRoadType={handleToggleRoadType}
                weatherLayerVisibility={weatherLayerVisibility}
                onToggleWeatherLayer={handleToggleWeatherLayer}
              />
            )}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            right: "10px",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "8px",
          }}
        >
          <LegendControl visibleLayers={weatherLayerVisibility} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              borderRadius: "4px",
              overflow: "hidden",
              borderTop: "1px solid #555",
            }}
          >
            <button
              onClick={handlePitchUp}
              style={
                currentPitch >= 60
                  ? {
                      ...disabledControlButtonStyle,
                      borderRadius: "4px 4px 0 0",
                      borderTop: "1px solid #555",
                    }
                  : {
                      ...controlButtonStyle,
                      borderRadius: "4px 4px 0 0",
                      borderTop: "1px solid #555",
                    }
              }
              title="Increase pitch"
              disabled={currentPitch >= 60}
            >
              <VscTriangleUp size={20} />
            </button>
            <button
              onClick={handlePitchDown}
              style={
                currentPitch <= 0
                  ? {
                      ...disabledControlButtonStyle,
                      borderRadius: "0 0 4px 4px",
                    }
                  : { ...controlButtonStyle, borderRadius: "0 0 4px 4px" }
              }
              title="Decrease pitch"
              disabled={currentPitch <= 0}
            >
              <VscTriangleDown size={20} />
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CursorCoordinates coords={cursorCoords} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                borderRadius: "4px",
                overflow: "hidden",
                borderTop: "1px solid #555",
              }}
            >
              <button
                onClick={handleZoomIn}
                style={{
                  ...controlButtonStyle,
                  borderRadius: "4px 4px 0 0",
                  borderTop: "1px solid #555",
                }}
                title="Zoom in"
              >
                <LuPlus size={20} />
              </button>
              <div
                style={{
                  ...controlButtonStyle,
                  borderTop: "none",
                  cursor: "default",
                  height: "32px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  fontFamily: "sans-serif",
                  color: "white",
                  backgroundColor: "#333",
                }}
              >
                {viewState.zoom?.toFixed(0)}
              </div>
              <button
                onClick={handleZoomOut}
                style={{ ...controlButtonStyle, borderRadius: "0 0 4px 4px" }}
                title="Zoom out"
              >
                <LuMinus size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapDashboard;
