/**
 * Media handling:
 * - inbound: download IM media (image/voice/video/file) to a local temp file;
 *   images are saved through the dsh attachment service so the model can see
 *   them; other files are exposed to the agent as a local path in the text.
 * - outbound: parse `[image:path]` / `[media:path]` / `[file:path]` markers in
 *   the final reply, upload the file to Wildfire and send it as a media
 *   message, stripping the marker from the text.
 */
export interface PreparedMedia {
    /** Text to include in the agent message (path note / transcript). */
    text: string;
    /** Image blocks ready for the user message (already saved via attachments). */
    images?: Array<{
        attachment: any;
    }>;
    /** Temp file to clean up after the turn. */
    tempPath?: string;
}
export interface OutboundMedia {
    path: string;
    isImage: boolean;
}
/** MIME type from the URL/file extension (best effort). */
declare function mimeFromExt(name: string, fallback: string): string;
/** Whether a file name looks like a raster image the attachment service accepts. */
declare function isImageExt(name: string): boolean;
/**
 * Download a remote media URL to a local temp file.
 * Returns the local path, or null on failure.
 *
 * 安全约束：remoteUrl 来自消息 payload（可被任意用户构造），因此
 * - 仅允许 http/https（file://、ftp:// 等一律拒绝）；
 * - 30s 超时；
 * - 64MB 大小上限（流式累计，超限中止）。
 */
export declare function downloadToTemp(remoteUrl: string, downloadDir: string, logger?: any): Promise<{
    path: string;
    ext: string;
} | null>;
/**
 * Prepare an inbound media message for the agent.
 * - image: save via `ctx.attachments.saveImages` -> image content block
 * - other: keep the local path as a text note (the agent reads it with fs tools)
 */
export declare function prepareInboundMedia(params: {
    mediaUrl: string;
    payloadType: number;
    downloadDir: string;
    attachments: any;
    logger?: any;
    transcript?: string;
    /** Whether the current model accepts image content blocks. When false,
     * images are exposed as a local path note instead (agent reads with tools). */
    supportsImage?: boolean;
}): Promise<PreparedMedia>;
/** Parse `[image:path]` / `[media:path]` / `[file:path]` markers out of text. */
export declare function extractOutboundMedia(text: string): {
    text: string;
    media: OutboundMedia[];
};
/**
 * Security fence for outbound media: resolve a marker path to its realpath and
 * require it to sit inside one of the allowed directories (typically the
 * conversation workspace and/or the configured `workspace.allowedRoots`).
 * Without this, a prompt-injected agent could exfiltrate arbitrary local
 * files (e.g. `[image:/etc/passwd]`) into the IM chat.
 */
export declare function resolveAllowedLocalPath(pth: string, allowedDirs: string[], logger?: any): Promise<string | null>;
/** Read a local file and upload it to Wildfire; returns the remote URL. */
export declare function uploadToWildfire(filePath: string, upload: (data: Buffer, fileName: string) => Promise<string | null>, logger?: any): Promise<string | null>;
/** Remove a temp file (best effort). */
export declare function cleanupTemp(tempPath?: string): void;
export { mimeFromExt, isImageExt };
//# sourceMappingURL=media.d.ts.map