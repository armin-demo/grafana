import * as H from 'history';
import React, { useContext } from 'react';
import { BehaviorSubject, type Observable, type Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';

import {
  deprecationWarning,
  type GrafanaLocation,
  type GrafanaLocationDescriptor,
  type GrafanaLocationDescriptorObject,
  type UrlQueryMap,
  urlUtil,
} from '@grafana/data';
import { attachDebugger, createLogger } from '@grafana/ui';

import { config } from '../config';

import { type LocationUpdate } from './LocationSrv';

/**
 * Callback used to decide whether a navigation should be blocked.
 * Return `false` or a string to block; `true` to allow.
 *
 * @public
 */
export type NavigationBlockCallback = (
  location: GrafanaLocation,
  action: 'PUSH' | 'REPLACE' | 'POP'
) => string | boolean;

/**
 * @public
 * A wrapper to help work with browser location and history
 */
export interface LocationService {
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: GrafanaLocationDescriptor) => void;
  replace: (location: GrafanaLocationDescriptor) => void;
  reload: () => void;
  getLocation: () => GrafanaLocation;
  /**
   * @deprecated Prefer `getLocation`, `subscribe`, `getLocationObservable`, and `blockNavigation`.
   * Direct history access will be removed when Grafana migrates off history@4 onto React Router navigation APIs.
   */
  getHistory: () => H.History;
  getSearch: () => URLSearchParams;
  getSearchObject: () => UrlQueryMap;
  getLocationObservable: () => Observable<GrafanaLocation>;
  /**
   * Subscribe to location changes without depending on the history package.
   * Returns an unsubscribe function.
   */
  subscribe: (listener: (location: GrafanaLocation) => void) => () => void;
  /**
   * Block navigations while the returned unblock function has not been called.
   * Prefer `FormPrompt` / `Prompt` for UI. This wraps history.block today and will
   * move to React Router blockers once a data router is adopted.
   */
  blockNavigation: (prompt: boolean | string | NavigationBlockCallback) => () => void;

  /**
   * This is from the old LocationSrv interface
   * @deprecated use partial, push or replace instead */
  update: (update: LocationUpdate) => void;
}

/** @internal */
export class HistoryWrapper implements LocationService {
  private readonly history: H.History;
  private locationObservable: BehaviorSubject<GrafanaLocation>;

  constructor(history?: H.History) {
    // If no history passed create an in memory one if being called from test
    this.history =
      history ||
      (process.env.NODE_ENV === 'test'
        ? H.createMemoryHistory({ initialEntries: ['/'] })
        : H.createBrowserHistory({ basename: config.appSubUrl ?? '/' }));

    this.locationObservable = new BehaviorSubject(this.history.location as GrafanaLocation);

    this.history.listen((location) => {
      this.locationObservable.next(location as GrafanaLocation);
    });

    this.partial = this.partial.bind(this);
    this.push = this.push.bind(this);
    this.replace = this.replace.bind(this);
    this.getSearch = this.getSearch.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getLocation = this.getLocation.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.blockNavigation = this.blockNavigation.bind(this);
  }

  getLocationObservable() {
    return this.locationObservable.asObservable();
  }

  subscribe(listener: (location: GrafanaLocation) => void) {
    // Match history.listen semantics: only future changes, not the current location.
    const subscription: Subscription = this.locationObservable.pipe(skip(1)).subscribe(listener);
    return () => subscription.unsubscribe();
  }

  blockNavigation(prompt: boolean | string | NavigationBlockCallback) {
    // history@4 block typing is incomplete; keep the adapter here so call sites stay history-free.
    // @ts-expect-error history@4 block callback types omit action in some typings
    return this.history.block(prompt);
  }

  /**
   * @deprecated Prefer `getLocation`, `subscribe`, `getLocationObservable`, and `blockNavigation`.
   */
  getHistory() {
    return this.history;
  }

  getSearch() {
    return new URLSearchParams(this.history.location.search);
  }

  partial(query: Record<string, any>, replace?: boolean) {
    const currentLocation = this.history.location;
    const newQuery = this.getSearchObject();

    for (const key in query) {
      // removing params with null | undefined
      if (query[key] === null || query[key] === undefined) {
        delete newQuery[key];
      } else {
        newQuery[key] = query[key];
      }
    }

    const updatedUrl = urlUtil.renderUrl(currentLocation.pathname, newQuery);

    if (replace) {
      this.history.replace(updatedUrl, this.history.location.state);
    } else {
      this.history.push(updatedUrl, this.history.location.state);
    }
  }

  push(location: GrafanaLocationDescriptor) {
    this.history.push(location as H.Path | H.LocationDescriptor);
  }

  replace(location: GrafanaLocationDescriptor) {
    this.history.replace(location as H.Path | H.LocationDescriptor);
  }

  reload() {
    const prevState = (this.history.location.state as any)?.routeReloadCounter;
    this.history.replace({
      ...this.history.location,
      state: { routeReloadCounter: prevState ? prevState + 1 : 1 },
    });
  }

  getLocation() {
    return this.history.location as GrafanaLocation;
  }

  getSearchObject() {
    return locationSearchToObject(this.history.location.search);
  }

  /** @deprecated use partial, push or replace instead */
  update(options: LocationUpdate) {
    deprecationWarning('LocationSrv', 'update', 'partial, push or replace');
    if (options.partial && options.query) {
      this.partial(options.query, options.partial);
    } else {
      const newLocation: GrafanaLocationDescriptorObject = {
        pathname: options.path,
      };
      if (options.query) {
        newLocation.search = urlUtil.toUrlParams(options.query);
      }
      if (options.replace) {
        this.replace(newLocation);
      } else {
        this.push(newLocation);
      }
    }
  }
}

/**
 * @public
 * Parses a location search string to an object
 * */
export function locationSearchToObject(search: string | number): UrlQueryMap {
  let queryString = typeof search === 'number' ? String(search) : search;

  if (queryString.length > 0) {
    if (queryString.startsWith('?')) {
      return urlUtil.parseKeyValue(queryString.substring(1));
    }
    return urlUtil.parseKeyValue(queryString);
  }

  return {};
}

/**
 * @public
 */
export let locationService: LocationService = new HistoryWrapper();

/**
 * Used for tests only
 * @internal
 */
export const setLocationService = (location: LocationService) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('locationService can be only overriden in test environment');
  }
  locationService = location;
};

const navigationLog = createLogger('Router');

/** @internal */
export const navigationLogger = navigationLog.logger;

// For debugging purposes the location service is attached to global _debug variable
attachDebugger('location', locationService, navigationLog);

// Simple context so the location service can be used without being a singleton
const LocationServiceContext = React.createContext<LocationService | undefined>(undefined);

export function useLocationService(): LocationService {
  const service = useContext(LocationServiceContext);
  if (!service) {
    throw new Error('useLocationService must be used within a LocationServiceProvider');
  }
  return service;
}

export const LocationServiceProvider: React.FC<{ service: LocationService; children: React.ReactNode }> = ({
  service,
  children,
}) => {
  return <LocationServiceContext.Provider value={service}>{children}</LocationServiceContext.Provider>;
};
