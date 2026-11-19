export type PluginActionInputByTarget = {
  /** Any flow or playlist the user can open. */
  playlist: { playlistId: string };
  /** A Library album id. */
  album: { albumId: string };
  /** A Library artist id or MBID. */
  artist: { artistId: string };
  /** Library track ids, 1 to 500. */
  track: { trackIds: string[] };
};

export type PluginActionTarget = keyof PluginActionInputByTarget;

export type PluginActionInput = PluginActionInputByTarget[PluginActionTarget];

export type PluginAction = {
  pluginId: string;
  pluginName: string;
  id: string;
  label: string;
  /** A target pocket doesn't know shows in no menu. */
  target: PluginActionTarget | (string & {});
};
