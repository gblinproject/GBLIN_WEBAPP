import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  account = signal<string | null>(null);

  constructor() {
    // AppKit disabled for testing
  }
}
