
export enum LocationType {
  URBAN = 'URBAN',
  RURAL = 'RURAL',
  COASTAL = 'COASTAL'
}

export interface ProjectRecord {
  id: string;
  buildingName: string;
  clientName: string;
  date: string;
  totalArea: number;
  length: number;
  breadth: number;
  buildingType: string;
  location: LocationType;
  budget: string;
  mainColor: string;
  style: string;
  floors: number;
  beforeImage?: string;
  afterImage?: string;
  constructionSteps?: string;
}

export type Language = 'en' | 'hi' | 'te';

export interface TranslationDictionary {
  [key: string]: {
    [lang in Language]: string;
  };
}

export interface User {
  id: string;
  username: string;
  role: 'CLIENT' | 'DEVELOPER';
  fullName: string;
}
