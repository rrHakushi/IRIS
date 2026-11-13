export type TesseractDeviceType = "desktop" | "mobile" | "tablet";

export interface TesseractPeerUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TesseractPeer {
  peerId: string;
  deviceId?: string;
  alias: string;
  deviceType: TesseractDeviceType;
  os: string;
  browser: string;
  isAuthenticated: boolean;
  user: TesseractPeerUser | null;
  requireShelfApproval: boolean;
  joinedAt: number;
}

export interface TesseractRoomInfo {
  roomId: string;
  lanScope: "lan" | "nat";
}

export interface TesseractTransferItemMeta {
  id: string;
  kind: "file" | "folder" | "text";
  name: string;
  size: number;
  mimeType?: string;
  fileCount?: number;
  textPreview?: string;
}

export interface TesseractDirectOfferPayload {
  offerId: string;
  fromPeerId: string;
  fromAlias: string;
  fromUserId: string | null;
  fromUser: TesseractPeerUser | null;
  toPeerId: string;
  items: TesseractTransferItemMeta[];
  totalBytes: number;
  createdAt: number;
}

export interface TesseractDirectResponsePayload {
  offerId: string;
  fromPeerId: string;
  toPeerId: string;
  accepted: boolean;
  autoAccepted?: boolean;
  reason?: string;
}

export type TesseractClientSignal =
  | { type: "ping" }
  | { type: "leave" }
  | {
      type: "peer:update";
      alias?: string;
      requireShelfApproval?: boolean;
    }
  | { type: "rtc:offer"; toPeerId: string; sdp: unknown }
  | { type: "rtc:answer"; toPeerId: string; sdp: unknown }
  | { type: "rtc:ice"; toPeerId: string; candidate: unknown }
  | {
      type: "direct:offer";
      toPeerId: string;
      offerId: string;
      items: TesseractTransferItemMeta[];
      totalBytes: number;
    }
  | {
      type: "direct:response";
      toPeerId: string;
      offerId: string;
      accepted: boolean;
      autoAccepted?: boolean;
      reason?: string;
    };

export type TesseractServerEvent =
  | {
      event: "room:joined";
      data: {
        selfPeerId: string;
        selfPeer: TesseractPeer;
        room: TesseractRoomInfo;
        peers: TesseractPeer[];
      };
      timestamp: number;
    }
  | { event: "peer:joined"; data: { peer: TesseractPeer }; timestamp: number }
  | { event: "peer:updated"; data: { peer: TesseractPeer }; timestamp: number }
  | { event: "peer:left"; data: { peerId: string }; timestamp: number }
  | {
      event: "rtc:offer";
      data: { fromPeerId: string; sdp: unknown };
      timestamp: number;
    }
  | {
      event: "rtc:answer";
      data: { fromPeerId: string; sdp: unknown };
      timestamp: number;
    }
  | {
      event: "rtc:ice";
      data: { fromPeerId: string; candidate: unknown };
      timestamp: number;
    }
  | {
      event: "direct:offer";
      data: TesseractDirectOfferPayload;
      timestamp: number;
    }
  | {
      event: "direct:response";
      data: TesseractDirectResponsePayload;
      timestamp: number;
    }
  | {
      event: "room:error";
      data: { code: string; message: string };
      timestamp: number;
    }
  | { event: "pong"; data: { timestamp: number }; timestamp: number };

