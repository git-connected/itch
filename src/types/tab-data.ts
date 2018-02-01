import { IGameSet, ICollectionSet, IUserSet } from "./index";

export interface ITabInstances {
  [key: string]: ITabInstance;
}

interface ITabUsers {
  /** users in relation to this tab */
  set: IUserSet;
}

export interface ITabGames {
  /** games in relation to this tab (single game, games in a collection) */
  set: IGameSet;
  ids: number[];
  allIds?: number[];
  totalCount?: number;
}

export interface ITabCollections {
  /** games in relation to this tab (single game, games in a collection) */
  set: ICollectionSet;
  ids: number[];
}

export interface ITabLocation {
  path: string;
}

export interface ITabWeb {
  /** numeric identifier of the electron web contents */
  webContentsId?: number;

  title?: string;
  favicon?: string;
  editingAddress?: boolean;
  loading?: boolean;
}

export interface ITabToast {
  /** error to show for toast tab */
  error?: string;

  /** stack trace to show for toast tab */
  stack?: string;
}

export interface ITabLog {
  log: string;
}

export interface ITabPage {
  /**
   * url of tab, something like:
   *   - itch://collections/:id
   *   - itch://games/:id
   *   - itch://preferences
   *   - https://google.com/
   *   - https://leafo.itch.io/x-moon
   */
  url: string;

  /**
   * resource associated with tab, something like
   *    - `games/:id`
   */
  resource?: string;
}

export interface ITabInstance {
  /** pages visited in this tab */
  history: ITabPage[];

  /** current index of history shown */
  currentIndex: number;

  /** data for the current page - is cleared on navigation */
  data: ITabData;

  /** if sleepy, don't load until it's focused */
  sleepy?: boolean;
}

export interface ITabData {
  users?: ITabUsers;
  games?: ITabGames;
  collections?: ITabCollections;
  web?: ITabWeb;
  toast?: ITabToast;
  location?: ITabLocation;
  log?: ITabLog;
}

export interface ITabDataSave extends ITabInstance {
  id: string;
}
