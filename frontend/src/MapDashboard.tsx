import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, MapRef, ViewState, ScaleControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// --- react-icons のインポート ---
import {
  LuMap, LuLayers, LuTriangleAlert,
  LuPlus, LuMinus,
  // --- サイドバー用アイコン ---
  LuLogIn, LuSettings
} from 'react-icons/lu';
// ピン留め用アイコン
import { BsPinFill, BsPinAngle } from "react-icons/bs";
import { VscTriangleUp, VscTriangleDown } from "react-icons/vsc";
import { FaSearchLocation, FaGlobeAmericas } from "react-icons/fa";
import { FaCar } from 'react-icons/fa6';
import { GiHorizonRoad } from "react-icons/gi";
import { BiErrorAlt } from "react-icons/bi";
// 凡例トグル用アイコン
import { MdNotifications, MdLegendToggle } from "react-icons/md";

// --- 初期視点を環境変数から読み込む ---
const INITIAL_VIEW_STATE = {
  longitude: parseFloat(import.meta.env.VITE_INITIAL_LONGITUDE || '-0.1278'),
  latitude: parseFloat(import.meta.env.VITE_INITIAL_LATITUDE || '51.5074'),
  zoom: parseInt(import.meta.env.VITE_INITIAL_ZOOM || '10', 10),
  pitch: 0,
  bearing: 0
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

// --- 開閉式凡例コンポーネント ---
const LegendControl = () => {
  const [isLegendOpen, setIsLegendOpen] = useState(false); // 凡例の開閉状態

  // 開いているときのスタイル
  const openStyle: React.CSSProperties = {
    backgroundColor: 'rgba(30,30,30,0.8)',
    color: 'white',
    border: '1px solid #555',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 1,
    fontFamily: 'sans-serif',
    fontSize: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    cursor: 'pointer', // 開いたパネルをクリックしても閉じられるように
  };

  // 閉じているときのスタイル (ボタン)
  const closedStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    padding: '5px',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  };

  if (isLegendOpen) {
    // 開いている状態
    return (
      <div style={openStyle} onClick={() => setIsLegendOpen(false)}>
        <h4 style={{ margin: '0 0 5px 0', color: 'white' }}>Speed (km/h)</h4>
        {legendData.map((item) => (
          <div key={item.speed} style={{ marginBottom: '3px' }}>
            <span style={{
              display: 'inline-block',
              width: '15px',
              height: '15px',
              backgroundColor: item.color,
              marginRight: '5px',
              verticalAlign: 'middle',
            }}></span>
            <span>{item.speed}</span>
          </div>
        ))}
      </div>
    );
  }

  // 閉じている状態 (ボタン)
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
const CursorCoordinates = ({ coords }: { coords: { lng: number; lat: number } | null }) => {
  if (!coords) return null;

  // 度 + 10進数の分 (小数点2桁)
  const toDegMin = (decimal: number, isLat: boolean) => {
      const degrees = Math.floor(Math.abs(decimal));
      const minutes = ((Math.abs(decimal) - degrees) * 60).toFixed(2);
      const direction = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
      return `${degrees}° ${String(minutes).padStart(5, '0')} ${direction}`;
  };

  return (
      <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '3px 8px',
          borderRadius: '3px',
          zIndex: 1,
          fontFamily: 'sans-serif',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          height: 'fit-content',
          alignSelf: 'center',
      }}>
          <FaGlobeAmericas size={20} />
          <div style={{ lineHeight: '1.3' }}>
              <div style={{ textAlign: 'right' }}>{toDegMin(coords.lat, true)}</div>
              <div style={{ textAlign: 'right' }}>{toDegMin(coords.lng, false)}</div>
              <div style={{ fontSize: '10px', color: '#ccc' }}>
                  ({coords.lat.toFixed(6)}, {coords.lng.toFixed(6)})
              </div>
          </div>
      </div>
  );
};


// --- ベースマップスタイル定義 ---
type BaseMapStyleKey = "positron" | "darkmatter" | "osm-standard" | "satellite";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
const baseMapUrls: Record<BaseMapStyleKey, string> = {
  positron: `${apiBaseUrl}/api/map/style.json`,
  darkmatter: `${apiBaseUrl}/api/map/style-dark.json`,
  osmStandard: `${apiBaseUrl}/api/map/style-osm-standard.json`,
  satellite: `${apiBaseUrl}/api/map/style-satellite.json`,
};

// --- 共通ボタンスタイル (ダークテーマ) ---
const controlButtonStyle: React.CSSProperties = {
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderTop: 'none',
    padding: '5px',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
};

// --- ベースマップ切り替えボタンコンポーネント ---
interface BaseMapSwitcherProps {
  currentStyle: BaseMapStyleKey;
  onChangeStyle: (styleKey: BaseMapStyleKey) => void;
}

const BaseMapSwitcher: React.FC<BaseMapSwitcherProps> = ({ currentStyle, onChangeStyle }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSelectStyle = (styleKey: BaseMapStyleKey) => {
    onChangeStyle(styleKey);
    setIsMenuOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        style={{ ...controlButtonStyle, borderTop: '1px solid #555', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
        title="Change map style"
      >
        <LuMap size={20} />
      </button>

      {isMenuOpen && (
        <div style={{
          position: 'absolute', top: '0', right: '40px',
          backgroundColor: 'rgba(30,30,30,0.8)',
          color: 'white',
          border: '1px solid #555',
          padding: '10px',
          borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          width: '120px',
          zIndex: 2,
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #555', paddingBottom: '4px', color: 'white' }}>Map type</h4>

          {(Object.keys(baseMapUrls) as BaseMapStyleKey[]).map((key) => {
              const label = key === 'positron' ? 'Light' :
                            key === 'darkmatter' ? 'Dark' :
                            key === 'osmStandard' ? 'OSM' :
                            key === 'satellite' ? 'Satellite' : key;
              return (
                  <label key={key} style={{
                      display: 'block', cursor: 'pointer', padding: '4px 0',
                      color: 'white', fontSize: '13px'
                  }}>
                      <input
                          type="radio"
                          name="base-map-style"
                          checked={currentStyle === key}
                          onChange={() => handleSelectStyle(key)}
                          style={{ marginRight: '8px', accentColor: 'white' }}
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
}

const LayerMenuPanel: React.FC<LayerMenuPanelProps> = ({
  isFlowVisible, onToggleFlow, isIncidentsVisible, onToggleIncidents
}) => (
  <div style={{
    position: 'absolute',
    top: '0',
    right: '40px',
    backgroundColor: 'rgba(30,30,30,0.8)',
    color: 'white',
    border: '1px solid #555',
    padding: '10px',
    borderRadius: '5px',
    zIndex: 1,
    width: '150px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif',
    fontSize: '12px',
  }}>
    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid #555', paddingBottom: '4px', color: 'white' }}>Layers</h4>
    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white' }}>
      <input
        type="checkbox"
        checked={isFlowVisible}
        onChange={onToggleFlow}
        style={{ marginRight: '5px', accentColor: 'white' }}
      />
      Traffic Flow
    </label>
    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: '5px', color: 'white' }}>
      <input
        type="checkbox"
        checked={isIncidentsVisible}
        onChange={onToggleIncidents}
        style={{ marginRight: '5px', accentColor: 'white' }}
      />
      Traffic Incidents
    </label>
  </div>
);


// --- サイドナビゲーション用コンポーネント ---
const navIconStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px', // 左右のパディングを 16px に
    cursor: 'pointer',
    color: '#eee', // アイコンの色
    borderRadius: '4px',
    margin: '5px 0', // 上下のマージン
};

const navIconHoverStyle: React.CSSProperties = {
    backgroundColor: '#444', // ホバー時の背景色
    color: 'white',
};

// NavItem component
const NavItem = ({ icon, text, isOpen }: { icon: React.ReactNode, text: string, isOpen: boolean }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div
            style={{
              ...navIconStyle,
              ...(isHovered ? navIconHoverStyle : {}),
              justifyContent: isOpen ? 'flex-start' : 'center', // 閉じているときは中央揃え
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={!isOpen ? text : undefined} // ツールチップを閉じてるときだけ表示
        >
            {icon}
            {isOpen && <span style={{ marginLeft: '12px', fontSize: '14px', whiteSpace: 'nowrap' }}>{text}</span>}
        </div>
    );
};

// ピン留めボタン用コンポーネント
const PinButton = ({ isPinned, onClick }: { isPinned: boolean, onClick: () => void }) => {
    const [isHovered, setIsHovered] = useState(false);

    const pinStyle: React.CSSProperties = {
        cursor: 'pointer',
        color: isHovered ? 'white' : '#999', // ホバーで白く
        transition: 'color 0.1s ease',
        padding: '5px',
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

// SideNavbar component
const SideNavbar = ({
    isOpen,
    isPinned,
    onPinToggle,
    onHoverEnter,
    onHoverLeave
}: {
    isOpen: boolean,
    isPinned: boolean,
    onPinToggle: () => void,
    onHoverEnter: () => void,
    onHoverLeave: () => void
}) => {
    return (
        <div
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                height: '100vh',
                width: isOpen ? '220px' : '52px', // 幅を 220px に
                backgroundColor: '#222',
                color: 'white',
                zIndex: 1003,
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 0',
                transition: 'width 0.2s ease-in-out',
                boxShadow: '2px 0 5px rgba(0,0,0,0.3)',
                fontFamily: 'sans-serif',
            }}
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
        >
            {/* Top Section */}
            <div>
                {/* サービスロゴとタイトル、ピン */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px', // NavItem と同じパディング
                    height: '40px', // NavItem と同じ高さ (10*2 + 20)
                    marginBottom: '10px',
                }}>
                    {/* ロゴ */}
                    <GiHorizonRoad size={isOpen ? 28 : 20} />

                    {/* テキストとピン (開いているときだけ表示) */}
                    {isOpen && (
                        <div style={{
                            marginLeft: '10px',
                            flexGrow: 1, // 残りのスペースを埋める
                            overflow: 'hidden',
                        }}>
                            <span style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: 'white',
                                whiteSpace: 'nowrap',
                            }}>
                                Real-time Traffic
                            </span>
                            <span style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: 'white',
                                whiteSpace: 'nowrap',
                                display: 'block', // 2行目
                            }}>
                                Flow Monitoring
                            </span>
                        </div>
                    )}
                    {/* ピンボタン (開いているときだけ表示) */}
                    {isOpen && (
                        <PinButton isPinned={isPinned} onClick={onPinToggle} />
                    )}
                </div>

                {/* Map Icon */}
                {/* <NavItem icon={<FaGlobeAmericas size={20} />} text="Map" isOpen={isOpen} /> */}
            </div>

            {/* Bottom Section */}
            <div style={{
                position: 'absolute',
                bottom: '20px', // 画面下端からの距離 (タスクバー分 + 5px)
                width: '100%',  // 親要素の幅に合わせる
            }}>
                <NavItem icon={<MdNotifications size={20} />} text="Notifications" isOpen={isOpen} />
                <NavItem icon={<LuLogIn size={20} />} text="Login" isOpen={isOpen} />
                <NavItem icon={<LuSettings size={20} />} text="Settings" isOpen={isOpen} />
            </div>
        </div>
    );
};


// --- 検索バーコンポーネント (Props を変更) ---
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
        // position 関連は親ラッパーで管理
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        border: '1px solid #555',
        borderRadius: '4px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        padding: '2px',
      }}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)} // 親の state を更新
        placeholder="Search location..."
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'white',
          padding: '8px 10px',
          fontSize: '14px',
          width: '300px', // 検索窓の幅
        }}
      />
      <button
        type="submit"
        style={{
          background: '#444',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          padding: '6px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Search"
      >
        <FaSearchLocation size={20} />
      </button>
    </form>
  );
};


// --- メインコンポーネント ---
function MapDashboard() {
  const [viewState, setViewState] = useState<Partial<ViewState>>(INITIAL_VIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [currentMapStyleKey, setCurrentMapStyleKey] = useState<BaseMapStyleKey>("positron");
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number } | null>(null);
  const [popupInfo, setPopupInfo] = useState<{ longitude: number; latitude: number; content: React.ReactNode } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);

  const [isFlowVisible, setIsFlowVisible] = useState(true);
  const [isIncidentsVisible, setIsIncidentsVisible] = useState(true);

  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lng: number; lat: number } | null>(null);

  // --- サイドバーの state ---
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHoverOpen, setIsSidebarHoverOpen] = useState(false);
  // 開閉状態を計算
  const isSidebarOpen = isSidebarPinned || isSidebarHoverOpen;

  // --- 検索クエリ用の state ---
  const [searchQuery, setSearchQuery] = useState("");


  const mapStyleUrl = baseMapUrls[currentMapStyleKey];

  const handleMapMove = useCallback((e: any) => {
      if (e.viewState) { setViewState(e.viewState); }
  }, []);

  const handleMapIdle = useCallback(() => {
    //
  }, []);

  const handleMapLoad = useCallback(() => {
      console.log('Map loaded via Map onLoad');
      // マップロード時にレイヤーの初期表示状態をセット
      const map = mapRef.current?.getMap();
      if (!map) return;

      const setInitialVisibility = () => {
        try {
            if (map.getLayer('tomtom-traffic-layer')) {
                map.setLayoutProperty('tomtom-traffic-layer', 'visibility', isFlowVisible ? 'visible' : 'none');
            }
            const incidentLayerIds = [
                'tomtom-traffic-incident-layer-outline',
                'tomtom-traffic-incident-layer-dash'
            ];
            incidentLayerIds.forEach(layerId => {
                if (map.getLayer(layerId)) {
                    map.setLayoutProperty(layerId, 'visibility', isIncidentsVisible ? 'visible' : 'none');
                }
            });
        } catch (error) {
            console.error("Error setting initial layer visibility (style might be changing):", error);
        }
      };

      if (map.isStyleLoaded()) {
        setInitialVisibility();
      } else {
        map.once('styledata', setInitialVisibility);
      }

  }, [isFlowVisible, isIncidentsVisible]);

  // --- Popup/Tooltipの内容を整形する関数 (JSX) ---
  // 交通流 (Flow) 用
  const formatFlowContent = (properties: any): React.ReactNode => {
    const style: React.CSSProperties = { fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 8px', borderRadius: '3px' };
    const title = (
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <FaCar size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Flow
        </strong>
    );
    if (!properties) return <div style={style}>{title}<br/>(No data)</div>;
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    const lines: React.ReactNode[] = [];
    const keys = Object.keys(properties).sort();
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                let displayValue = String(value);
                if (key === 'traffic_level') {
                    displayValue += ' km/h';
                }
                lines.push(
                    <span style={{ overflowWrap: 'break-word' }} key={key}>
                        <strong>{formattedKey}:</strong> {displayValue}
                    </span>
                );
            }
        }
    }
    const content = (lines.length === 0)
        ? "(No detailed info available)"
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{lines}</div>;
    return <div style={style}>{title}{content}</div>;
  };

  // --- 日付フォーマット用ヘルパー関数 ---
  const formatDateUTC = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            return isoString;
        }
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
    } catch (e) {
        return isoString;
    }
  };

  // インシデント (Incident) 用
  const formatIncidentContent = (properties: any): React.ReactNode => {
    const style: React.CSSProperties = { fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px', backgroundColor: 'rgba(255,249,196,0.9)', color: 'black', padding: '5px 8px', borderRadius: '3px', border: '1px solid #E0E0E0' };
    const title = (
        <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <LuTriangleAlert size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Incident
        </strong>
    );
    if (!properties) return <div style={style}>{title}<br/>(No data)</div>;
    const iconCategoryMap: { [key: number]: string } = {
        0: 'Unknown',
        1: 'Accident',
        2: 'Fog',
        3: 'Dangerous Conditions',
        4: 'Rain',
        5: 'Ice',
        6: 'Jam',
        7: 'Lane Closed',
        8: 'Road Closed',
        9: 'Road Works',
        10: 'Wind',
        11: 'Flooding',
        14: 'Broken Down Vehicle'
    };
    const internalKeys = new Set(['$type', 'layer', 'source', 'sourceLayer', 'state', 'tile']);
    const dateKeys = new Set(['end_date', 'last_report_time']);
    const lines: React.ReactNode[] = [];
    const keys = Object.keys(properties).sort();
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(properties, key) && !internalKeys.has(key)) {
            const value = properties[key];
            if (value !== undefined && value !== null) {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                let displayValue = String(value);
                if (key === 'delay') {
                    displayValue = `${String(value)} s`;
                } else if (key === 'magnitude') {
                    let magnitudeText = 'Unknown';
                    switch (Number(value)) {
                        case 1: magnitudeText = 'Minor'; break;
                        case 2: magnitudeText = 'Moderate'; break;
                        case 3: magnitudeText = 'Major'; break;
                        case 4: magnitudeText = 'Indefinite'; break;
                    }
                    if (Number(value) === 4) {
                        displayValue = `${String(value)}. Indefinite (road closures and other delays with an unstated length of time)`;
                    } else {
                        displayValue = `${String(value)}. ${magnitudeText}`;
                    }
                } else if (key.startsWith('icon_category')) {
                    const numericValue = Number(value);
                    const description = iconCategoryMap[numericValue];
                    if (description !== undefined) {
                        displayValue = `${String(value)}. ${description}`;
                    } else {
                        displayValue = `${String(value)}. Other`;
                    }
                } else if (dateKeys.has(key) && typeof value === 'string' && value.endsWith('Z')) {
                    displayValue = formatDateUTC(value);
                }
                lines.push(
                    <span style={{ overflowWrap: 'break-word' }} key={key}>
                        <strong>{formattedKey}:</strong> {displayValue}
                    </span>
                );
            }
        }
    }
    const content = (lines.length === 0)
        ? "(No detailed info available)"
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{lines}</div>;
    return <div style={style}>{title}{content}</div>;
  };


  // --- マウスホバー時の処理 ---
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    // カーソル座標を更新
    setCursorCoords(event.lngLat);

    const { features, point } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = (flowFeature || incidentFeature) ? 'pointer' : '';

    let content: React.ReactNode = null;
    if (incidentFeature) {
      content = formatIncidentContent(incidentFeature.properties);
    } else if (flowFeature) {
      content = formatFlowContent(flowFeature.properties);
    }

    if (content) {
      setHoverInfo({ x: point.x, y: point.y });
      setTooltipContent(content);
      setPopupInfo(null);
    } else {
      setHoverInfo(null);
      setTooltipContent(null);
    }
  }, []);

  // --- 地図からマウスが離れた時の処理 ---
  const handleMouseOut = useCallback(() => {
    setCursorCoords(null);
  }, []);

  // --- クリック時の処理 ---
  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const { features, lngLat } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );

    let featureToShow = null;
    let content: React.ReactNode = null;

    if (incidentFeature) {
        featureToShow = incidentFeature;
        content = formatIncidentContent(featureToShow.properties);
    } else if (flowFeature) {
        featureToShow = flowFeature;
        content = formatFlowContent(featureToShow.properties);
    }

    if (featureToShow) {
        setHoverInfo(null);
        setTooltipContent(null);
        setPopupInfo({
            longitude: lngLat.lng,
            latitude: lngLat.lat,
            content: content
        });
    } else {
        setPopupInfo(null);
    }
  }, []);

  // --- エラー表示の5秒タイマー ---
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000); // 5000ms = 5秒

      // コンポーネントがアンマウントされるか、errorが変更された場合にタイマーをクリア
      return () => clearTimeout(timer);
    }
  }, [error]); // error state が変更されるたびに実行

  // --- ツールチップの位置調整ロジック ---
  useEffect(() => {
        if (tooltipRef.current && hoverInfo && tooltipContent) {
            const tooltipElement = tooltipRef.current;
            const mapWrapper = tooltipElement.parentElement; // マップラッパー
            if (!mapWrapper) return;

            const tooltipRect = tooltipElement.getBoundingClientRect();
            const tooltipHeight = tooltipRect.height;
            const tooltipWidth = tooltipRect.width;
            const tooltipOffset = 15;

            // マップラッパーのサイズとウィンドウ内での位置を取得
            const wrapperRect = mapWrapper.getBoundingClientRect();

            // hoverInfo.x/y はマップラッパーの左上隅からの相対座標
            // finalTop/Left もマップラッパーの左上隅からの相対座標

            let finalTop = hoverInfo.y + tooltipOffset;
            let finalLeft = hoverInfo.x + tooltipOffset;

            // --- 垂直方向（上下）のチェック ---
            // ツールチップの下端がラッパーの下端を超えるか？
            if (finalTop + tooltipHeight > wrapperRect.height - 30) { // 30pxマージン (attribution)
                // 超えるなら、カーソルの上に表示
                finalTop = hoverInfo.y - tooltipHeight - tooltipOffset;
            }
            // ツールチップの上端がラッパーの上端を超えるか？（カーソルの上に表示した場合）
            if (finalTop < 10) { // 10pxマージン
                // 超えるなら、上端に固定
                finalTop = 10;
            }

            // --- 水平方向（左右）のチェック ---
            // ツールチップの右端がラッパーの右端を超えるか？
            if (finalLeft + tooltipWidth > wrapperRect.width - 10) { // 10pxマージン (UI)
                // 超えるなら、カーソルの左に表示
                finalLeft = hoverInfo.x - tooltipWidth - tooltipOffset;
            }
            // ツールチップの左端がラッパーの左端を超えるか？
            if (finalLeft < 10) { // 10pxマージン
                // 超えるなら、左端に固定
                finalLeft = 10;
            }

            tooltipElement.style.top = `${finalTop}px`;
            tooltipElement.style.left = `${finalLeft}px`;
            tooltipElement.style.visibility = 'visible';
        } else if (tooltipRef.current) {
            tooltipElement.style.visibility = 'hidden';
        }
  }, [hoverInfo, tooltipContent]);

  // --- ホバー用ツールチップ ---
  const renderTooltip = () => {
        if (!hoverInfo || !tooltipContent) return null;

        const tooltipStyle: React.CSSProperties = {
            position: 'absolute',
            zIndex: 1002,
            pointerEvents: 'none',
            transformOrigin: 'top left',
            visibility: 'hidden',
        };

        return (
            <div ref={tooltipRef} style={tooltipStyle}>
              {tooltipContent}
            </div>
        );
  };

  // --- レイヤー表示切り替えロジック ---
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) {
        return;
    }

    try {
        if (map.getLayer('tomtom-traffic-layer')) {
            map.setLayoutProperty('tomtom-traffic-layer', 'visibility', isFlowVisible ? 'visible' : 'none');
        }

        const incidentLayerIds = [
            'tomtom-traffic-incident-layer-outline',
            'tomtom-traffic-incident-layer-dash'
        ];

        incidentLayerIds.forEach(layerId => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', isIncidentsVisible ? 'visible' : 'none');
            }
        });

    } catch (error) {
        console.error("Error setting layer visibility (style might be changing):", error);
    }
  }, [isFlowVisible, isIncidentsVisible, currentMapStyleKey]);

  // --- ズーム/ピッチ コントロール関数 ---
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const PITCH_LEVELS = [0, 30, 45, 60];
  const currentPitch = viewState.pitch || 0;

  const handlePitchUp = () => {
      const nextPitch = PITCH_LEVELS.find(p => p > currentPitch);
      mapRef.current?.easeTo({ pitch: nextPitch !== undefined ? nextPitch : PITCH_LEVELS[PITCH_LEVELS.length - 1] });
  };
  const handlePitchDown = () => {
      const prevPitch = [...PITCH_LEVELS].reverse().find(p => p < currentPitch);
      mapRef.current?.easeTo({ pitch: prevPitch !== undefined ? prevPitch : PITCH_LEVELS[0] });
  };

  // ダークテーマ
  const disabledControlButtonStyle: React.CSSProperties = {
      ...controlButtonStyle,
      cursor: 'not-allowed',
      backgroundColor: '#222',
      color: '#777'
  };

  // --- 検索ハンドラ ---
  const handleSearch = async (query: string) => {
    setError(null); // 以前のエラーをクリア
    try {
      const response = await fetch(`${apiBaseUrl}/api/geocode?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Location not found");
      }

      const data = await response.json();

      if (data.latitude && data.longitude) {
        // マップを指定の座標に移動 (flyTo)
        // flyTo が完了するのを待つ
        await mapRef.current?.flyTo({
          center: [data.longitude, data.latitude],
          zoom: INITIAL_VIEW_STATE.zoom, // 地名検索後の適切なズームレベル
          pitch: 0, // 検索時は真上から
          bearing: 0,
          essential: true,
        });
        setSearchQuery(""); // アニメーション完了後にクエリをクリア
      } else {
        throw new Error("Invalid coordinates received from server");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      setError(err.message || "Failed to geocode location");
    }
  };


  // --- レンダリング ---
  return (
    // 全体を包むラッパー
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* サイドナビゲーションバー */}
      <SideNavbar
          isOpen={isSidebarOpen}
          isPinned={isSidebarPinned}
          onPinToggle={() => setIsSidebarPinned(!isSidebarPinned)}
          onHoverEnter={() => setIsSidebarHoverOpen(true)}
          onHoverLeave={() => setIsSidebarHoverOpen(false)}
      />

      {/* マップとUIコントロールのラッパー */}
      <div style={{
          position: 'relative',
          height: '100%',
          // 'isSidebarOpen' ではなく 'isSidebarPinned' (ピン留め状態) にのみ依存させる
          marginLeft: isSidebarPinned ? '220px' : '52px',
          transition: 'margin-left 0.2s ease-in-out',
      }}>

        {/* 検索バーとエラーメッセージのラッパー */}
        <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5px' // 検索バーとエラー間の隙間
        }}>
            {/* 検索バー */}
            <SearchBar
                query={searchQuery}
                setQuery={setSearchQuery}
                onSearch={handleSearch}
            />

            {/* エラーメッセージ */}
            {error && (
              <div style={{
                backgroundColor: 'rgba(255, 0, 0, 0.8)', color: 'white', padding: '10px 15px',
                borderRadius: '5px',
                maxWidth: '400px',
                textAlign: 'left', // 左揃えに変更
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                display: 'flex', // アイコンとテキストを横に並べる
                alignItems: 'center',
                gap: '8px' // アイコンとテキストの隙間
              }}>
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
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyleUrl}
          initialViewState={INITIAL_VIEW_STATE}
          onLoad={handleMapLoad}
          attributionControl={true}
          interactiveLayerIds={[
              'tomtom-traffic-layer',
              'tomtom-traffic-incident-layer-outline',
              'tomtom-traffic-incident-layer-dash'
          ]}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseOut={handleMouseOut}
        >
            <ScaleControl unit="metric" position="bottom-left" />

            {popupInfo && (
                <Popup
                    longitude={popupInfo.longitude}
                    latitude={popupInfo.latitude}
                    closeButton={true}
                    closeOnClick={false}
                    onClose={() => setPopupInfo(null)}
                    anchor="bottom"
                    style={{ maxHeight: '200px', overflowY: 'auto' }}
                >
                  {popupInfo.content}
                </Popup>
            )}
        </Map>

        {renderTooltip()}


        {/* --- Top Right UI Group --- */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {/* 1. Base Map */}
          <BaseMapSwitcher currentStyle={currentMapStyleKey} onChangeStyle={setCurrentMapStyleKey} />

          {/* 2. Layers */}
          <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
                style={{ ...controlButtonStyle, borderTop: '1px solid #555', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                title="Toggle layers"
              >
                <LuLayers size={20} />
              </button>
              {isLayerMenuOpen && (
                  <LayerMenuPanel
                      isFlowVisible={isFlowVisible}
                      onToggleFlow={() => setIsFlowVisible(!isFlowVisible)}
                      isIncidentsVisible={isIncidentsVisible}
                      onToggleIncidents={() => setIsIncidentsVisible(!isIncidentsVisible)}
                  />
              )}
          </div>
        </div>

        {/* --- Bottom Right UI Group --- */}
        <div style={{
            position: 'absolute',
            bottom: '40px', // クレジットとのマージン
            right: '10px',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '8px'
        }}>
            {/* 1. Legend */}
            <LegendControl />

            {/* 2. Pitch */}
            <div style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', borderTop: '1px solid #555' }}>
                <button
                    onClick={handlePitchUp}
                    style={(currentPitch >= 60) ? {...disabledControlButtonStyle, borderRadius: '4px 4px 0 0', borderTop: '1px solid #555'} : {...controlButtonStyle, borderRadius: '4px 4px 0 0', borderTop: '1px solid #555'}}
                    title="Increase pitch"
                    disabled={currentPitch >= 60}
                >
                    <VscTriangleUp size={20} />
                </button>
                <button
                    onClick={handlePitchDown}
                    style={(currentPitch <= 0) ? {...disabledControlButtonStyle, borderRadius: '0 0 4px 4px'} : {...controlButtonStyle, borderRadius: '0 0 4px 4px'}}
                    title="Decrease pitch"
                    disabled={currentPitch <= 0}
                >
                    <VscTriangleDown size={20} />
                </button>
            </div>

            {/* 3. Coords + Zoom Group */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '8px'
            }}>
                {/* 3a. Coordinates */}
                <CursorCoordinates coords={cursorCoords} />

                {/* 3b. Zoom Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', borderRadius: '4px', overflow: 'hidden', borderTop: '1px solid #555' }}>
                    <button onClick={handleZoomIn} style={{...controlButtonStyle, borderRadius: '4px 4px 0 0', borderTop: '1px solid #555'}} title="Zoom in">
                        <LuPlus size={20} />
                    </button>
                    <div style={{
                        ...controlButtonStyle,
                        borderTop: 'none',
                        cursor: 'default',
                        height: '32px',
                        fontSize: '12px', fontWeight: 'bold', fontFamily: 'sans-serif',
                        color: 'white',
                        backgroundColor: '#333',
                    }}>
                        {viewState.zoom?.toFixed(0)}
                    </div>
                    <button onClick={handleZoomOut} style={{...controlButtonStyle, borderRadius: '0 0 4px 4px'}} title="Zoom out">
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
