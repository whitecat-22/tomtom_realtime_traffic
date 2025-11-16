import axios from 'axios';

// バックエンド (FastAPI) のベースURL
const API_BASE_URL = 'http://127.0.0.1:8001';

const client = axios.create({
  baseURL: API_BASE_URL,
});

// エラーレスポンスを整形
const handleError = (error: any) => {
  if (axios.isAxiosError(error) && error.response) {
    // バックエンド (FastAPI) が転送した TomTom API のエラー
    return Promise.reject(error.response);
  }
  // ネットワークエラーなど
  return Promise.reject(error);
};

client.interceptors.response.use(response => response.data, handleError);

export const api = {
  /**
   * (未使用)
   */
  getTrafficIncidents: (bbox: string, zoom: number) => {
    return client.get('/api/traffic/incidents', {
      params: {
        bbox: bbox,
        zoom: zoom,
      },
    });
  },

  /**
   * Flow Segment Data (v4) API を呼び出す
   * @param z ズームレベル
   * @param lat 緯度
   * @param lon 経度
   */
  getFlowSegmentData: (z: number, lat: number, lon: number) => {
    // main.py のパス定義 /api/traffic/flow-segment/absolute/{z}/json に合わせる
    const apiPath = `/api/traffic/flow-segment/absolute/${z}/json`;

    return client.get(apiPath, {
      params: {
        lat: lat,
        lon: lon,
      },
    });
  },

  /**
   * Incident Details (v5) API を呼び出す
   * @param id インシデントID (v4タイルから取得)
   */
  getIncidentDetails: (id: string) => {
    return client.get(`/api/traffic/incident-detail/${id}`);
  },

};
