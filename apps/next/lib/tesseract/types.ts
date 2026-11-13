import type {
  TesseractDeviceType,
  TesseractDirectOfferPayload,
  TesseractDirectResponsePayload,
  TesseractPeer,
  TesseractPeerUser,
  TesseractRoomInfo,
  TesseractTransferItemMeta,
} from "@NamelessLiberty/shared"

export type {
  TesseractDeviceType,
  TesseractDirectOfferPayload,
  TesseractDirectResponsePayload,
  TesseractPeer,
  TesseractPeerUser,
  TesseractRoomInfo,
  TesseractTransferItemMeta,
}

export interface SharedLocalFileEntry {
  id: string
  relativePath: string
  name: string
  size: number
  mimeType: string
  lastModified: number
  file: File
}

export interface SharedLocalFileItem {
  id: string
  kind: "file"
  name: string
  size: number
  mimeType: string
  lastModified: number
  file: File
}

export interface SharedLocalFolderItem {
  id: string
  kind: "folder"
  name: string
  totalSize: number
  fileCount: number
  files: SharedLocalFileEntry[]
}

export interface SharedLocalTextItem {
  id: string
  kind: "text"
  title?: string
  content: string
  isUrl: boolean
  createdAt: number
}

export type SharedLocalItem =
  | SharedLocalFileItem
  | SharedLocalFolderItem
  | SharedLocalTextItem

export interface RemoteFileEntry {
  id: string
  relativePath: string
  name: string
  size: number
  mimeType: string
  lastModified: number
}

export interface RemoteFileItem {
  id: string
  kind: "file"
  name: string
  size: number
  mimeType: string
  lastModified: number
}

export interface RemoteFolderItem {
  id: string
  kind: "folder"
  name: string
  totalSize: number
  fileCount: number
  files: RemoteFileEntry[]
}

export interface RemoteTextItem {
  id: string
  kind: "text"
  title?: string
  content: string
  isUrl: boolean
  createdAt: number
}

export type RemoteShelfItem = RemoteFileItem | RemoteFolderItem | RemoteTextItem

export interface PeerConnectionDiagnostics {
  state: "idle" | "connecting" | "connected" | "unreachable"
  candidateType?: string
  errorReason?: string
}

export type TransferStatus =
  | "pending-approval"
  | "active"
  | "completed"
  | "declined"
  | "cancelled"
  | "failed"

export interface TransferTask {
  id: string
  direction: "send" | "receive"
  mode: "pull" | "direct"
  peerId: string
  peerAlias: string
  itemsSummary: string
  fileCount: number
  totalBytes: number
  transferredBytes: number
  speedBytesPerSec: number
  etaSeconds: number | null
  status: TransferStatus
  error?: string
  startedAt: number
  completedAt?: number
}

export interface IncomingShelfApprovalRequest {
  requestId: string
  fromPeerId: string
  fromAlias: string
  itemNames: string[]
  totalBytes: number
  fileCount: number
}

export interface OutgoingTransferFileSpec {
  fileId: string
  name: string
  relativePath: string
  size: number
  mimeType: string
  file: File
}

