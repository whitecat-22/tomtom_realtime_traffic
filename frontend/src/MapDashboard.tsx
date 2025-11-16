import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map, MapRef, ViewState, ScaleControl } from 'react-map-gl/maplibre';
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
import { FaSearchLocation, FaGlobeAmericas, FaWindowClose } from "react-icons/fa";
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

// --- 道路種別データ (0-8) ---
const roadTypeData = [
  { id: 0, label: 'Motorway' },
  { id: 1, label: 'International road' },
  { id: 2, label: 'Major road' },
  { id: 3, label: 'Secondary road' },
  { id: 4, label: 'Connecting road' },
  { id: 5, label: 'Major local road' },
  { id: 6, label: 'Local road' },
  { id: 7, label: 'Minor local road' },
  { id: 8, label: 'Other roads' }, // Other roads (Non public road, Parking road, etc.)
];

// フィルタ対象のレイヤーIDをコンポーネント外の定数として定義
const layersToFilter = [
  'tomtom-traffic-layer', // Flow レイヤー
  'tomtom-traffic-incident-layer-outline', // Incident レイヤー
  'tomtom-traffic-incident-layer-dash'      // Incident レイヤー
];


// --- 開閉式凡例コンポーネント ---
const LegendControl = () => {
  const [isLegendOpen, setIsLegendOpen] = useState(false); // 凡例の開閉状態
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
    cursor: 'pointer',
  };
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
                            key === ('osmStandard' || 'osm-standard') ? 'OSM' :
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
  selectedRoadTypes: Set<number>;
  onToggleRoadType: (id: number) => void;
}

const LayerMenuPanel: React.FC<LayerMenuPanelProps> = ({
  isFlowVisible, onToggleFlow, isIncidentsVisible, onToggleIncidents,
  selectedRoadTypes, onToggleRoadType
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
    width: '180px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif',
    fontSize: '12px',
    maxHeight: '80vh',
    overflowY: 'auto',
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
    <h5 style={{
      margin: '12px 0 5px 0',
      fontSize: '13px',
      borderBottom: '1px solid #444',
      paddingBottom: '3px',
      color: 'white'
    }}>
      Road Types
    </h5>
    {roadTypeData.map((rt) => (
      <label key={rt.id} style={{
        cursor: isFlowVisible ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        marginTop: '4px',
        color: isFlowVisible ? 'white' : '#888',
        fontSize: '12px'
      }}>
        <input
          type="checkbox"
          checked={selectedRoadTypes.has(rt.id)}
          onChange={() => onToggleRoadType(rt.id)}
          disabled={!isFlowVisible}
          style={{ marginRight: '5px', accentColor: 'white' }}
        />
        {rt.label}
      </label>
    ))}
  </div>
);


// --- サイドナビゲーション用コンポーネント ---
const navIconStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    cursor: 'pointer',
    color: '#eee',
    borderRadius: '4px',
    margin: '5px 0',
};
const navIconHoverStyle: React.CSSProperties = {
    backgroundColor: '#444',
    color: 'white',
};
const NavItem = ({ icon, text, isOpen }: { icon: React.ReactNode, text: string, isOpen: boolean }) => {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div
            style={{
              ...navIconStyle,
              ...(isHovered ? navIconHoverStyle : {}),
              justifyContent: isOpen ? 'flex-start' : 'center',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={!isOpen ? text : undefined}
        >
            {icon}
            {isOpen && <span style={{ marginLeft: '12px', fontSize: '14px', whiteSpace: 'nowrap' }}>{text}</span>}
        </div>
    );
};
const PinButton = ({ isPinned, onClick }: { isPinned: boolean, onClick: () => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    const pinStyle: React.CSSProperties = {
        cursor: 'pointer',
        color: isHovered ? 'white' : '#999',
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
                width: isOpen ? '220px' : '52px',
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
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    height: '40px',
                    marginBottom: '10px',
                }}>
                    <GiHorizonRoad size={isOpen ? 28 : 20} />
                    {isOpen && (
                        <div style={{
                            marginLeft: '10px',
                            flexGrow: 1,
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
                                display: 'block',
                            }}>
                                Flow Monitoring
                            </span>
                        </div>
                    )}
                    {isOpen && (
                        <PinButton isPinned={isPinned} onClick={onPinToggle} />
                    )}
                </div>
            </div>
            {/* Bottom Section */}
            <div style={{
                position: 'absolute',
                bottom: '20px',
                width: '100%',
            }}>
                <NavItem icon={<MdNotifications size={20} />} text="Notifications" isOpen={isOpen} />
                <NavItem icon={<LuLogIn size={20} />} text="Login" isOpen={isOpen} />
                <NavItem icon={<LuSettings size={20} />} text="Settings" isOpen={isOpen} />
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
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search location..."
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'white',
          padding: '8px 10px',
          fontSize: '14px',
          width: '300px',
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

// --- ツールチップの内容生成ロジック ---
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
const formatFlowContent = (properties: any, isPinned: boolean, onClose: () => void): React.ReactNode => {
  const style: React.CSSProperties = {
    fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px',
    backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
    padding: '5px 8px', borderRadius: '3px',
    position: 'relative',
  };
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
  const closeButton = isPinned && (
      <FaWindowClose
          size={16}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              cursor: 'pointer',
              color: 'white'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.5)')}
      />
  );
  return <div style={style}>{closeButton}{title}{content}</div>;
};
const formatIncidentContent = (properties: any, isPinned: boolean, onClose: () => void): React.ReactNode => {
  const style: React.CSSProperties = {
    fontFamily: 'sans-serif', fontSize: '12px', maxWidth: '250px',
    backgroundColor: 'rgba(255,249,196,0.9)', color: 'black',
    padding: '5px 8px', borderRadius: '3px', border: '1px solid #E0E0E0',
    position: 'relative',
  };
  const title = (
      <strong style={{ fontSize: '14px', display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <LuTriangleAlert size={16} style={{ verticalAlign: 'middle', marginRight: '5px' }} /> Traffic Incident
      </strong>
  );
  if (!properties) return <div style={style}>{title}<br/>(No data)</div>;
  const iconCategoryMap: { [key: number]: string } = {
      0: 'Unknown', 1: 'Accident', 2: 'Fog', 3: 'Dangerous Conditions', 4: 'Rain',
      5: 'Ice', 6: 'Jam', 7: 'Lane Closed', 8: 'Road Closed', 9: 'Road Works',
      10: 'Wind', 11: 'Flooding', 14: 'Broken Down Vehicle'
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
  const closeButton = isPinned && (
      <FaWindowClose
          size={16}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              cursor: 'pointer',
              color: 'black'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)')}
      />
  );
  return <div style={style}>{closeButton}{title}{content}</div>;
};

// --- roadTypeData に基づく 'match' 式のペアをここで生成
const roadTypeMatchPairs = roadTypeData.flatMap(rt => [rt.label, rt.id]);


// --- メインコンポーネント ---
function MapDashboard() {
  const [viewState, setViewState] = useState<Partial<ViewState>>(INITIAL_VIEW_STATE);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [currentMapStyleKey, setCurrentMapStyleKey] = useState<BaseMapStyleKey>("positron");
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipContent, setTooltipContent] = useState<React.ReactNode>(null);
  const [isClickTooltipPinned, setIsClickTooltipPinned] = useState(false);
  const [isFlowVisible, setIsFlowVisible] = useState(true);
  const [isIncidentsVisible, setIsIncidentsVisible] = useState(true);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [selectedRoadTypes, setSelectedRoadTypes] = useState<Set<number>>(
    new Set(roadTypeData.map(rt => rt.id))
  );
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHoverOpen, setIsSidebarHoverOpen] = useState(false);
  const isSidebarOpen = isSidebarPinned || isSidebarHoverOpen;
  const [searchQuery, setSearchQuery] = useState("");
  const mapStyleUrl = baseMapUrls[currentMapStyleKey];

  const handleMapMove = useCallback((e: any) => {
      if (e.viewState) { setViewState(e.viewState); }
  }, []);

  const handleMapIdle = useCallback(() => {
    //
  }, []);

  // --- マウスホバー時の処理 ---
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    if (isClickTooltipPinned) {
      return;
    }
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
    const dummyOnClose = () => {};
    if (incidentFeature) {
      content = formatIncidentContent(incidentFeature.properties, false, dummyOnClose);
    } else if (flowFeature) {
      content = formatFlowContent(flowFeature.properties, false, dummyOnClose);
    }
    if (content) {
      setHoverInfo({ x: point.x, y: point.y });
      setTooltipContent(content);
    } else {
      setHoverInfo(null);
      setTooltipContent(null);
    }
  }, [isClickTooltipPinned]);

  // --- 地図からマウスが離れた時の処理 ---
  const handleMouseOut = useCallback(() => {
    setCursorCoords(null);
  }, []);

  // --- クリック時の処理 ---
  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const handleCloseTooltip = () => {
      setIsClickTooltipPinned(false);
      setTooltipContent(null);
    };
    const { features, point } = event;
    const flowFeature = features && features.find(f => f.layer.id === 'tomtom-traffic-layer');
    const incidentFeature = features && features.find(f =>
        f.layer.id === 'tomtom-traffic-incident-layer-outline' ||
        f.layer.id === 'tomtom-traffic-incident-layer-dash'
    );
    let featureToShow = null;
    let content: React.ReactNode = null;
    if (incidentFeature) {
        featureToShow = incidentFeature;
        content = formatIncidentContent(featureToShow.properties, true, handleCloseTooltip);
    } else if (flowFeature) {
        featureToShow = flowFeature;
        content = formatFlowContent(featureToShow.properties, true, handleCloseTooltip);
    }
    if (featureToShow) {
        setHoverInfo({ x: point.x, y: point.y });
        setTooltipContent(content);
        setIsClickTooltipPinned(true);
    } else {
        setIsClickTooltipPinned(false);
        setTooltipContent(null);
    }
  }, []);

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
              tooltipElement.style.visibility = 'visible';
            });
        } else if (tooltipRef.current) {
            tooltipRef.current.style.visibility = 'hidden';
        }
  }, [hoverInfo, tooltipContent, isClickTooltipPinned]);

  // --- ホバー用ツールチップ ---
  const renderTooltip = () => {
        if (!tooltipContent) return null;
        const tooltipStyle: React.CSSProperties = {
            position: 'absolute',
            zIndex: 1002,
            pointerEvents: isClickTooltipPinned ? 'auto' : 'none',
            transformOrigin: 'top left',
            visibility: 'hidden',
        };
        return (
            <div ref={tooltipRef} style={tooltipStyle}>
              {tooltipContent}
            </div>
        );
  };

  // フィルタリングと表示ロジック

  // フィルタと表示状態を適用するコアロジックを 'useCallback' でメモ化
  const applyFiltersAndVisibility = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // 競合状態対策:
    // 必要なレイヤー (layersToFilter[0]) が存在するか確認する
    // !map.isStyleLoaded() も追加して、スタイルがロード中も待機
    if (!map.isStyleLoaded() || !map.getLayer(layersToFilter[0])) {
      // 警告メッセージをコメントアウト
      // console.warn("applyFiltersAndVisibility: Style or layers not ready, retrying on next render.");
      map.once('render', applyFiltersAndVisibility); // ★ここで再試行を予約
      return;
    }

    try {
      // --- 1. 表示/非表示 (Visibility) ---
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

      // --- 2. 道路種別フィルタリング (Road Type Filtering) ---
      let roadTypeFilter: any[] | null;
      if (selectedRoadTypes.size === 0) {
          roadTypeFilter = ['==', ['get', 'road_type'], "___NONE___"];
      } else if (selectedRoadTypes.size === roadTypeData.length) {
          roadTypeFilter = null; // フィルタなし (すべて表示)
      } else {
          const roadTypeMatchExpression = [
              'match',
              ['get', 'road_type'],
              ...roadTypeMatchPairs, // [ 'Motorway', 0, 'International road', 1, ... ]
              -1 // デフォルト値
          ];
          roadTypeFilter = [
              'in',
              roadTypeMatchExpression,
              ['literal', Array.from(selectedRoadTypes)]
          ];
      }

      // フィルタを全レイヤーに適用
      layersToFilter.forEach(layerId => {
          if (map.getLayer(layerId)) {
              map.setFilter(layerId, roadTypeFilter);
          } else {
              throw new Error(`Layer ${layerId} not found during filter application.`);
          }
      });

    } catch (error) {
        // 警告メッセージをコメントアウト
        // console.warn("Error setting filter (retrying on next render):", error);
        // map.once が重複しないように、既存のリスナーを削除してから追加する
        map.off('render', applyFiltersAndVisibility);
        map.once('render', applyFiltersAndVisibility);
    }
  }, [isFlowVisible, isIncidentsVisible, selectedRoadTypes]); // 依存配列

  // チェックボックスのON/OFFなど、state変更時にフィルタを即時適用する
  useEffect(() => {
    const map = mapRef.current?.getMap();
    // マップがロード済みの場合にのみ実行
    if (map && map.isStyleLoaded()) {
      applyFiltersAndVisibility();
    }
  }, [isFlowVisible, isIncidentsVisible, selectedRoadTypes, applyFiltersAndVisibility]);

  // ベースマップ切替 ('onStyleData') ハンドラ
  const handleStyleLoadOrChange = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      // スタイルがロードされ始めたら、すぐに適用を試みる
      // 内部の 'render' 再試行ロジックが競合状態を処理する
      applyFiltersAndVisibility();
    }
  }, [applyFiltersAndVisibility]); //


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
        await mapRef.current?.flyTo({
          center: [data.longitude, data.latitude],
          zoom: INITIAL_VIEW_STATE.zoom,
          pitch: 0,
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


  // --- 道路種別 (Road Type) 切り替えハンドラ ---
  const handleToggleRoadType = (typeId: number) => {
    setSelectedRoadTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(typeId)) {
        newSet.delete(typeId);
      } else {
        newSet.add(typeId);
      }
      return newSet;
    });
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
            gap: '5px'
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
                textAlign: 'left',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
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
          attributionControl={true}
          interactiveLayerIds={layersToFilter}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseOut={handleMouseOut}
          onLoad={handleStyleLoadOrChange}
          onStyleData={handleStyleLoadOrChange}
        >
            <ScaleControl unit="metric" position="bottom-left" />
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
                      selectedRoadTypes={selectedRoadTypes}
                      onToggleRoadType={handleToggleRoadType}
                  />
              )}
          </div>
        </div>

        {/* --- Bottom Right UI Group --- */}
        <div style={{
            position: 'absolute',
            bottom: '40px',
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
