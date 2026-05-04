import { Component, input, AfterViewInit, ViewChild, inject, OnInit, effect } from '@angular/core';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { Priority } from '../../types/priority';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-priority-list',
  imports: [HlmTableImports, HlmSpinnerImports, ScrollingModule],
  templateUrl: './priority-list.html',
  styleUrl: './priority-list.scss',
  host: {
    class: 'w-full',
  },
})
export class PriorityList implements AfterViewInit, OnInit {
  @ViewChild('tableViewport') viewport?: CdkVirtualScrollViewport;
  priorities = input<Priority[]>([]);

  constructor() {
    effect(() => {
      console.log('Priorities changed:', this.priorities());
      if (!this.viewport) return;

      const priorities = this.priorities();
      if (priorities) {
        const range = this.viewport.getRenderedRange();
        console.log(`CDK Viewport Start: ${range.start}, End: ${range.end}`);
        console.log('Total Priorities:', priorities.length);
        this.viewport.scrollToIndex(0); // Scroll to top when priorities change
      }
    });
  }

  ngOnInit(): void {
    console.log('Viewport:', this.viewport);
  }
  ngAfterViewInit(): void {
    console.log('Viewport:', this.viewport);
  }

  scrollIndexChange(index: number) {
    console.log('Scrolled to index:', index);

    if (this.viewport) {
      const range = this.viewport.getRenderedRange();
      console.log(`CDK Viewport Start: ${range.start}, End: ${range.end}`);
    }
  }

  protected _invoices = [
    {
      invoice: 'INV001',
      paymentStatus: 'Paid',
      totalAmount: '$250.00',
      paymentMethod: 'Credit Card',
    },
    {
      invoice: 'INV002',
      paymentStatus: 'Pending',
      totalAmount: '$150.00',
      paymentMethod: 'PayPal',
    },
    {
      invoice: 'INV003',
      paymentStatus: 'Unpaid',
      totalAmount: '$350.00',
      paymentMethod: 'Bank Transfer',
    },
    {
      invoice: 'INV004',
      paymentStatus: 'Paid',
      totalAmount: '$450.00',
      paymentMethod: 'Credit Card',
    },
    {
      invoice: 'INV005',
      paymentStatus: 'Paid',
      totalAmount: '$550.00',
      paymentMethod: 'PayPal',
    },
    {
      invoice: 'INV006',
      paymentStatus: 'Pending',
      totalAmount: '$200.00',
      paymentMethod: 'Bank Transfer',
    },
    {
      invoice: 'INV007',
      paymentStatus: 'Unpaid',
      totalAmount: '$300.00',
      paymentMethod: 'Credit Card',
    },
  ];
}
