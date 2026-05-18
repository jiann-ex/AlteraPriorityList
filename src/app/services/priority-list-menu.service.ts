import { Injectable } from '@angular/core';

export type PriorityListMenuEvent = 'reload' | 'expandAll' | 'collapseAll';
export type EventCallback<T> = (event: PriorityListMenuEvent, payload?: T) => void;

/**
 * Meant to be used as a shared service for the priority list menu,
 * allowing components menu component to trigger some events to the priority list components
 */
@Injectable({
  providedIn: 'root',
})
export class PriorityListMenuService {
  private _listeners: EventCallback<any>[] = [];

  reload() {
    this._emitEvent('reload');
  }
  expandAll() {
    this._emitEvent('expandAll');
  }
  collapseAll() {
    this._emitEvent('collapseAll');
  }

  private _emitEvent<T>(event: PriorityListMenuEvent, payload?: T) {
    this._listeners.forEach((listener) => listener(event, payload));
  }

  /** Add a listener for priority list menu events */
  registerListener<T>(callback: EventCallback<T>) {
    this._listeners.push(callback);
  }

  /** Must be called to remove a listener when a component is destroyed or something */
  deregisterListener<T>(callback: EventCallback<T>) {
    this._listeners = this._listeners.filter((listener) => listener !== callback);
  }
}
