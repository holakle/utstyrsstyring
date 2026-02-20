export type TagType = "asset" | "user";
/**
 * shared/index.ts
 *
 * Dette er "kontrakten" mellom backend (api) og frontend (web).
 * Her definerer vi typer slik at alle er enige om hvordan data ser ut.
 */

export type TagType = "asset" | "user";

/**
 * ZoneType:
 * - WAREHOUSE: inne på lageret
 * - PORTAL_IN: ved døra på innsiden
 * - PORTAL_OUT: ved døra på utsiden
 */
export type ZoneType = "WAREHOUSE" | "PORTAL_IN" | "PORTAL_OUT";

/**
 * Observation = en rå observasjon fra en gateway.
 * (I MVP sender simulatoren disse, men senere vil gateways sende dem.)
 */
export type Observation = {
  gatewayId: string; // Hvilken gateway som observerte signalet
  zone: ZoneType;    // Hvilken sone gatewayen tilhører
  ts: string;        // Tidspunkt (ISO string)
  tagId: string;     // ID på taggen (A123 for utstyr, U001 for bruker)
  tagType: TagType;  // asset eller user
  rssi: number;      // Signalstyrke, f.eks -45 (nær) til -95 (langt)
};

export type EventType = "ENTER" | "EXIT" | "CHECKOUT" | "CHECKIN";

/**
 * DomainEvent = en "tolket hendelse" laget av regelmotoren.
 * Dette er mer "business": EXIT, CHECKOUT, osv.
 */
export type DomainEvent = {
  type: EventType;
  ts: string;
  assetTagId: string;      // hvilket utstyr
  userTagId?: string;      // hvem (hvis vi vet)
  confidence: number;      // hvor sikker algoritmen er (0..1)
  details?: Record<string, unknown>; // ekstra debug/info
};