/**
 * LiveKit Egress API Client
 *
 * Cloudflare Workers compatible implementation using fetch
 * Based on: https://docs.livekit.io/home/egress/api/
 */

import { generateLiveKitToken, VideoGrant } from './livekit-jwt';

/**
 * Participant info from LiveKit Room API
 */
export interface ParticipantInfo {
  sid: string;
  identity: string;
  name: string;
  metadata: string;
  state: number;
}

/**
 * Egress status - can be string or number depending on API version
 */
export enum EgressStatus {
  EGRESS_STARTING = 0,
  EGRESS_ACTIVE = 1,
  EGRESS_ENDING = 2,
  EGRESS_COMPLETE = 3,
  EGRESS_FAILED = 4,
  EGRESS_ABORTED = 5,
  EGRESS_LIMIT_REACHED = 6,
}

/**
 * Check if egress status indicates active recording
 */
export function isEgressActive(status: EgressStatus | string | number): boolean {
  if (typeof status === 'string') {
    return status === 'EGRESS_STARTING' || status === 'EGRESS_ACTIVE';
  }
  return status === EgressStatus.EGRESS_STARTING || status === EgressStatus.EGRESS_ACTIVE;
}

/**
 * S3 Upload configuration
 */
export interface S3UploadConfig {
  accessKey: string;
  secret: string;
  region: string;
  endpoint?: string;
  bucket: string;
  forcePathStyle?: boolean;
}

/**
 * File output configuration
 */
export interface EncodedFileOutputConfig {
  fileType?: 'DEFAULT_FILETYPE' | 'MP4';
  filepath: string;
  disableManifest?: boolean;
  s3?: S3UploadConfig;
}

/**
 * Room composite egress request
 */
export interface RoomCompositeEgressRequest {
  roomName: string;
  layout?: string;
  audioOnly?: boolean;
  videoOnly?: boolean;
  customBaseUrl?: string;
  fileOutputs?: EncodedFileOutputConfig[];
  preset?: 'H264_720P_30' | 'H264_720P_60' | 'H264_1080P_30' | 'H264_1080P_60' | 'PORTRAIT_H264_720P_30' | 'PORTRAIT_H264_720P_60' | 'PORTRAIT_H264_1080P_30' | 'PORTRAIT_H264_1080P_60';
}

/**
 * Egress info response
 */
export interface EgressInfo {
  egressId: string;
  roomId: string;
  roomName: string;
  status: EgressStatus;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  fileResults?: Array<{
    filename: string;
    duration: number;
    size: number;
    location: string;
  }>;
}

/**
 * LiveKit Egress API Client
 */
export class EgressClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(livekitUrl: string, apiKey: string, apiSecret: string) {
    // Convert ws:// or wss:// to https://
    const url = new URL(livekitUrl);
    url.protocol = 'https:';
    this.baseUrl = url.origin;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Generate access token for Egress API
   */
  private async getAccessToken(): Promise<string> {
    const grant: VideoGrant = {
      roomRecord: true,
    };

    return generateLiveKitToken(
      this.apiKey,
      this.apiSecret,
      { identity: 'egress-api' },
      grant,
      60 // 1 minute TTL
    );
  }

  /**
   * Make API request to LiveKit Egress
   */
  private async request<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/twirp/livekit.Egress/${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Egress API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List active egress sessions for a room
   */
  async listEgress(options: { roomName?: string; egressId?: string; active?: boolean } = {}): Promise<EgressInfo[]> {
    const body: Record<string, unknown> = {};

    if (options.roomName) {
      body.room_name = options.roomName;
    }
    if (options.egressId) {
      body.egress_id = options.egressId;
    }
    if (options.active !== undefined) {
      body.active = options.active;
    }

    const result = await this.request<{ items?: Record<string, unknown>[] }>('ListEgress', body);
    return (result.items || []).map((item) => this.mapEgressInfo(item));
  }

  /**
   * Start room composite egress (recording)
   */
  async startRoomCompositeEgress(
    roomName: string,
    output: { file?: EncodedFileOutputConfig },
    options: { layout?: string; preset?: string } = {}
  ): Promise<EgressInfo> {
    const body: Record<string, unknown> = {
      room_name: roomName,
    };

    if (options.layout) {
      body.layout = options.layout;
    }

    if (options.preset) {
      body.preset = options.preset;
    }

    if (output.file) {
      body.file_outputs = [this.buildFileOutput(output.file)];
    }

    const result = await this.request<Record<string, unknown>>('StartRoomCompositeEgress', body);
    return this.mapEgressInfo(result);
  }

  /**
   * Stop an active egress session
   */
  async stopEgress(egressId: string): Promise<EgressInfo> {
    const result = await this.request<Record<string, unknown>>('StopEgress', {
      egress_id: egressId,
    });
    return this.mapEgressInfo(result);
  }

  /**
   * Build file output configuration for API
   */
  private buildFileOutput(config: EncodedFileOutputConfig): Record<string, unknown> {
    const output: Record<string, unknown> = {
      file_type: config.fileType || 'MP4',
      filepath: config.filepath,
    };

    if (config.disableManifest) {
      output.disable_manifest = config.disableManifest;
    }

    if (config.s3) {
      output.s3 = {
        access_key: config.s3.accessKey,
        secret: config.s3.secret,
        region: config.s3.region,
        bucket: config.s3.bucket,
        endpoint: config.s3.endpoint,
        force_path_style: config.s3.forcePathStyle ?? true,
      };
    }

    return output;
  }

  /**
   * Map API response to EgressInfo
   */
  private mapEgressInfo(data: Record<string, unknown>): EgressInfo {
    return {
      egressId: data.egress_id as string || data.egressId as string,
      roomId: data.room_id as string || data.roomId as string,
      roomName: data.room_name as string || data.roomName as string,
      status: data.status as EgressStatus,
      startedAt: data.started_at as string || data.startedAt as string,
      endedAt: data.ended_at as string || data.endedAt as string,
      error: data.error as string,
      fileResults: data.file_results as EgressInfo['fileResults'] || data.fileResults as EgressInfo['fileResults'],
    };
  }

  /**
   * Get participant from a room by identity
   * Uses LiveKit Room Service API
   */
  async getParticipant(roomName: string, identity: string): Promise<ParticipantInfo | null> {
    const grant: VideoGrant = {
      roomAdmin: true,
      room: roomName,
    };

    const token = await generateLiveKitToken(
      this.apiKey,
      this.apiSecret,
      { identity: 'room-service' },
      grant,
      60
    );

    const url = `${this.baseUrl}/twirp/livekit.RoomService/GetParticipant`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room: roomName,
          identity: identity,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as Record<string, unknown>;
      return {
        sid: data.sid as string,
        identity: data.identity as string,
        name: data.name as string,
        metadata: data.metadata as string,
        state: data.state as number,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a participant has recording permission
   */
  async checkRecordingPermission(roomName: string, identity: string): Promise<boolean> {
    const participant = await this.getParticipant(roomName, identity);
    if (!participant || !participant.metadata) {
      return false;
    }

    try {
      const metadata = JSON.parse(participant.metadata);
      return metadata.canRecord === true;
    } catch {
      return false;
    }
  }
}
