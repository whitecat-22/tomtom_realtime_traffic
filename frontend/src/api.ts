import axios from 'axios';

// バックエンド (FastAPI) のベースURL
// (api.ts は /api プレフィックスを管理しないように変更)
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
   * 交通インシデント（事故・規制）データを取得する
   * @param bbox 表示領域 (minLon,minLat,maxLon,maxLat)
   * @param zoom 現在のズームレベル
   */
  getTrafficIncidents: (bbox: string, zoom: number) => {
    return client.get('/api/traffic/incidents', {
      params: {
        bbox: bbox,
        zoom: zoom, // FastAPI側では受け取るが、TomTom API v5 には渡されない
      },
    });
  },
  
  // getConfig (APIキー取得) は削除
};
