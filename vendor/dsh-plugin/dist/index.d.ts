/**
 * Wildfire IM channel plugin for DeepSeek Harness.
 *
 * Cordis plugin — install into a dsh profile and activate via the profile's
 * patch layer (see README.md / DSH_INTEGRATION.md).
 */
export declare const name = "wildfire";
export declare const inject: string[];
/**
 * Plugin entry.
 * @param ctx - Cordis context of the dsh process.
 * @param config - config from the profile patch row (`config` field).
 */
export declare function apply(ctx: any, config: any): void;
export default apply;
//# sourceMappingURL=index.d.ts.map