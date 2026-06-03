export interface LogisticsPreset {
  id?: string;
  preset_key: string;
  name: string;
  sender: string;
  consignee: string;
  carrier: string;
  load_place: string;
  load_country: string;
  delivery_place: string;
  delivery_country: string;
  default_goods: string;
  default_instructions: string;
  source_files?: string[];
}

export interface LogisticsTemplateRow {
  kind: "route" | "cmr";
  name: string;
  original_path: string | null;
  storage_path: string;
}

export interface CmrClient {
  client_key: string;
  name: string;
  consignee: string;
  transitario: string;
  country: string;
  default_goods: string;
  is_edeka: boolean;
  occurrences: number;
}

export interface CmrCarrier {
  carrier_key: string;
  name: string;
  details: string;
  country: string;
  occurrences: number;
}

export interface TripFields {
  numeroCarta: string;
  fechaCarga: string;
  fechaDescarga: string;
  horaCarga: string;
  horaDescarga: string;
  routeOperator: string;
  routeCarrierName: string;
  vehiclePlate: string;
  routeDescription: string;
  instructions: string;
  successiveCarriersEnabled: boolean;
  successiveCarriers: string;
  carrierReservations: string;
  documents: string;
  goodsLine: string;
  bultos: string;
  mercancia: string;
  peso: string;
  volume: string;
  specialAgreements: string;
  usefulParticulars17: string;
  nonContractual18: string;
  cashOnDelivery19: string;
  consigneeReceipt24: string;
  tractora: string;
  remolque: string;
  conductor: string;
  documento1: string;
  documento2: string;
  observaciones: string;
}

export type DocumentKind = "route" | "cmr";
