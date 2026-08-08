export type ErrorResponse = {
  statusCode?: number;
  errorCode?: string;
  message?: string | string[];
  details?: unknown;
};

export type UserDto = {
  id: string;
  email: string;
  nickname: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  accessTokenExpiresIn: number;
  user: UserDto;
};

export type CitySearchResultDto = {
  name: string;
  countryCode?: string;
  lat: number;
  lon: number;
  timezone?: string;
};

export type WatchlistCityDto = {
  id: string;
  name: string;
  countryCode?: string | null;
  lat: number;
  lon: number;
  timezone: string;
};

export type WatchlistItemDto = {
  userId: string;
  cityId: string;
  sortOrder: number;
  createdAt: string;
  city: WatchlistCityDto;
};

export type CityDashboardResponseDto = {
  city: WatchlistCityDto;
  current: {
    time?: string;
    apparentTemperature?: number;
    temperature?: number;
    humidity?: number;
    precipitation?: number;
    windSpeed?: number;
    windGusts?: number;
    windDirection?: number;
    weatherCode?: number;
  };
  hourly: {
    times: string[];
    temperature?: number[];
    precipitation?: number[];
    windSpeed?: number[];
    windGusts?: number[];
    humidity?: number[];
    weatherCode?: number[];
  };
  daily: {
    dates: string[];
    tempMin?: number[];
    tempMax?: number[];
    precipitationSum?: number[];
    windMax?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
  airQuality: {
    times: string[];
    pm25?: number[];
    pm10?: number[];
    no2?: number[];
    o3?: number[];
  };
  meta: {
    lastUpdated: string;
    isStale: boolean;
    sources: {
      current: boolean;
      hourly: boolean;
      daily: boolean;
      airQuality: boolean;
    };
  };
};

export type ArticleDto = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  markdown: string;
  status?: 'DRAFT' | 'PUBLISHED';
  isFlagged?: boolean;
  flagCategory?: string | null;
  flagSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  flagReason?: string | null;
  moderationStatus?: 'CLEAN' | 'EXPLICIT' | 'BLOCKED';
  createdAt: string;
  publishedAt?: string | null;
  updatedAt?: string;
  author?: {
    id: string;
    email: string;
    nickname: string;
    role: 'USER' | 'ADMIN';
    avatarUrl?: string | null;
  };
  _count?: {
    likes: number;
    comments: number;
  };
};

export type ArticleLikeStateDto = {
  articleId: string;
  liked: boolean;
  likesCount: number;
};

export type ArticleStatsDto = {
  articleId: string;
  slug: string;
  likesCount: number;
  commentsCount: number;
};

export type ArticleCommentDto = {
  id: string;
  articleId: string;
  userId: string;
  body: string;
  isFlagged: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  user: {
    id: string;
    email: string;
    nickname: string;
    role: 'USER' | 'ADMIN';
    avatarUrl?: string | null;
  };
};

export type PublicUserDto = {
  id: string;
  email: string;
  nickname: string;
  role: 'USER' | 'ADMIN';
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
};

export type PublicUserProfileDto = PublicUserDto & {
  publishedArticlesCount: number;
};

export type ModerationCategory = 'PROFANITY' | 'HATE_SPEECH' | 'HARASSMENT';

export type AdminModerationCommentDto = {
  id: string;
  articleId: string;
  userId: string;
  body: string;
  isFlagged: boolean;
  flagCategory?: string | null;
  flagSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  flagReason?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  user: {
    id: string;
    email: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  article: {
    id: string;
    slug: string;
    title: string;
  };
};

export type AdminModerationPageDto = {
  items: AdminModerationCommentDto[];
  page: number;
  pageSize: number;
  total: number;
};



export type AlertMetric = 'TEMPERATURE' | 'WIND_SPEED' | 'HUMIDITY' | 'PRECIPITATION' | 'PM25' | 'PM10';

export type AlertOperator = 'GT' | 'GTE' | 'LT' | 'LTE';

export type AlertRuleDto = {
  id: string;
  userId: string;
  cityId: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  isActive: boolean;
  lastConditionMet: boolean;
  lastEvaluationValue?: number | null;
  lastEvaluatedAt?: string | null;
  lastTriggeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  city: {
    id: string;
    name: string;
    countryCode?: string | null;
    timezone?: string;
  };
};

export type AlertEventDto = {
  id: string;
  ruleId: string;
  userId: string;
  cityId: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  observedValue: number;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  city: {
    id: string;
    name: string;
    countryCode?: string | null;
    timezone?: string;
  };
  rule: {
    id: string;
    isActive: boolean;
  };
};

export type AdminModerationArticleDto = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  status: 'DRAFT' | 'PUBLISHED';
  isFlagged: boolean;
  flagCategory?: string | null;
  flagSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  flagReason?: string | null;
  moderationStatus: 'CLEAN' | 'EXPLICIT' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  author: {
    id: string;
    email: string;
    nickname: string;
    role: 'USER' | 'ADMIN';
    avatarUrl?: string | null;
  };
  _count: {
    likes: number;
    comments: number;
  };
};

export type AdminModerationArticlesPageDto = {
  items: AdminModerationArticleDto[];
  page: number;
  pageSize: number;
  total: number;
};
