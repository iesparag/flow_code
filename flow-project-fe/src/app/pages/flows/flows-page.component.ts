import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoFlowsService } from '../../services/auto-flows.service';
import { TemplatesService } from '../../services/templates.service';
import { EmailTemplate } from '../../models/template.model';
import { AutomationFlow } from '../../models/automation-flow.model';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FFlowModule } from '@foblex/flow';

@Component({
  selector: 'app-flows-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatListModule, MatIconModule, MatSelectModule, MatTooltipModule, MatSnackBarModule,
    DragDropModule, FFlowModule
  ],
  templateUrl: './flows-page.component.html',
  styleUrls: ['./flows-page.component.scss']
})
export class FlowsPageComponent {
  flows: AutomationFlow[] = [];
  name = '';
  startNodeId = 'n1';

  // Builder state
  steps: Array<any> = [
    { id: 'n1', type: 'sendEmail', title: 'Intro Email', templateId: '', next: [], pos: { x: 60, y: 60 } }
  ];
  selectedIndex = 0;
  saving = false;

  templates: EmailTemplate[] = [];

  // Visual layout settings
  readonly nodeW = 220;
  readonly nodeH = 100;
  readonly hGap = 80;   // horizontal gap between nodes in same layer
  readonly vGap = 150;  // vertical gap between layers
  viewBox = '0 0 1200 800';
  canvasW = 1200;
  canvasH = 800;
  linkFromId: string | null = null;
  showFlowsModal = false;
  
  // Zoom and transform properties
  zoomLevel = 1.0;
  transformOrigin = 'center center';
  private minZoom = 0.2;
  private maxZoom = 3.0;
  connections: Array<{fOutputId: string, fInputId: string}> = [];
  editingFlow: AutomationFlow | null = null;

  // Sidebar state
  leftSidebarOpen = true;
  rightSidebarOpen = false;

  // Canvas panning state
  @ViewChild('canvasContainer') canvasContainerRef!: ElementRef<HTMLDivElement>;
  isPanning = false;
  private panStart = { x: 0, y: 0 };
  private panScrollStart = { left: 0, top: 0 };

  constructor(private api: AutoFlowsService, private snack: MatSnackBar, private tplApi: TemplatesService) {
    this.load();
    this.tplApi.list().subscribe({ next: (res) => this.templates = res, error: () => {} });
    // Initialize canvas size and connections
    setTimeout(() => {
      this.computeCanvasSizeFromManual();
      this.updateConnections();
    }, 0);
    
    // Listen for window resize events to recalculate canvas
    window.addEventListener('resize', () => {
      this.computeCanvasSizeFromManual();
    });
  }

  load() {
    this.api.list().subscribe((items) => this.flows = items);
  }

  create() {
    const nodes = this.serialize();
    if (!nodes.length) { this.snack.open('Add at least one step', 'OK', { duration: 1500 }); return; }
    const flow: AutomationFlow = { name: this.name || 'Untitled Flow', startNodeId: this.startNodeId, nodes } as any;
    this.saving = true;
    this.api.create(flow).subscribe({
      next: () => {
        this.snack.open('Flow created', 'OK', { duration: 1500 });
        this.name = ''; this.resetBuilder(); this.startNodeId = 'n1';
        this.load();
      },
      error: () => this.snack.open('Create failed', 'Dismiss', { duration: 2000 }),
      complete: () => this.saving = false
    });
  }

  publish(f: AutomationFlow) {
    if (!f._id) return;
    this.api.publish(f._id).subscribe((res) => { this.load(); alert('Published v' + res.version); });
  }

  // ---- Builder helpers ----
  resetBuilder() {
    this.steps = [{ id: 'n1', type: 'sendEmail', title: 'Intro Email', templateId: '', next: [], pos: { x: 60, y: 60 } }];
    this.selectedIndex = 0;
    this.editingFlow = null;
    this.name = '';
    this.computeCanvasSizeFromManual();
    this.updateConnections();
  }

  addStep(type: 'sendEmail'|'wait'|'conditionReply'|'end') {
    const newId = this.generateId();
    const step: any = { id: newId, type, pos: this.getNextPosition(), next: [] };
    if (type === 'sendEmail') Object.assign(step, { title: 'Email', templateId: '' });
    if (type === 'wait') Object.assign(step, { delayMs: 3600_000 });
    this.steps.push(step);
    this.selectedIndex = this.steps.length - 1;
    
    // Ensure right sidebar is open when adding a new step
    if (!this.rightSidebarOpen) {
      this.rightSidebarOpen = true;
      setTimeout(() => {
        this.computeCanvasSizeFromManual();
      }, 300);
    }
    
    // Update connections and canvas size
    this.updateConnections();
    this.computeCanvasSizeFromManual();
  }

  deleteStep(i: number) {
    const id = this.steps[i]?.id;
    this.steps.splice(i, 1);
    for (const s of this.steps) {
      if (Array.isArray(s.next)) s.next = s.next.filter((e: any) => e.to !== id);
    }
    if (this.selectedIndex >= this.steps.length) this.selectedIndex = Math.max(0, this.steps.length - 1);
    
    // Update connections and canvas after deletion
    this.updateConnections();
    this.computeCanvasSizeFromManual();
  }

  link(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = this.steps.find(s => s.id === fromId);
    const to = this.steps.find(s => s.id === toId);
    if (!from || !to) return;
    
    from.next = from.next || [];
    // Check if connection already exists in data model
    if (!from.next.find((e: any) => e.to === toId)) {
      from.next.push({ to: toId });
    }
    this.updateConnections();
  }

  unlink(fromId: string, toId: string) {
    const from = this.steps.find(s => s.id === fromId);
    if (!from || !from.next) return;
    from.next = from.next.filter((e: any) => e.to !== toId);
    this.updateConnections();
  }

  // Quickly add a Wait + Email sequence and link from the currently selected step
  addFollowUp() {
    const from = this.steps[this.selectedIndex];
    const wait = { id: this.generateId(), type: 'wait', delayMs: 24*60*60*1000, next: [], pos: this.getNextPosition() } as any;
    this.steps.push(wait);
    const email = { id: this.generateId(), type: 'sendEmail', title: 'Follow-up Email', templateId: '', next: [], pos: this.getNextPosition() } as any;
    this.steps.push(email);
    if (from) {
      from.next = from.next || [];
      if (!from.next.find((e: any) => e.to === wait.id)) from.next.push({ to: wait.id });
    }
    wait.next.push({ to: email.id });
    this.selectedIndex = this.steps.length - 1;
    this.updateConnections();
  }

  // ----- Visual helpers -----
  get selectedStep() { return this.steps[this.selectedIndex]; }

  getNode(id: string) {
    return this.steps.find(s => s.id === id);
  }

  edgePath(fromId: string, toId: string) {
    const from = this.getNode(fromId);
    const to = this.getNode(toId);
    if (!from || !to) return '';
    const x1 = (from.pos?.x ?? 0) + this.nodeW / 2;
    const y1 = (from.pos?.y ?? 0) + this.nodeH;
    const x2 = (to.pos?.x ?? 0) + this.nodeW / 2;
    const y2 = (to.pos?.y ?? 0);
    const dy = Math.max(40, (y2 - y1) / 2);
    const c1x = x1;
    const c1y = y1 + dy;
    const c2x = x2;
    const c2y = y2 - dy;
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
  }

  selectById(id: string) {
    const i = this.steps.findIndex(s => s.id === id);
    if (i >= 0) this.selectedIndex = i;
  }

  onFoblexDragEnd(id: string, ev: any) {
    const i = this.steps.findIndex(s => s.id === id);
    if (i < 0) return;
    const pos = ev.source.getFreeDragPosition?.() || { x: 0, y: 0 };
    this.steps[i].pos = { x: pos.x, y: pos.y };
    
    // Update connections after node position change
    this.updateConnections();
    this.computeCanvasSizeFromManual();
  }

  startLinkFromSelected() {
    const sel = this.steps[this.selectedIndex];
    if (sel) this.linkFromId = sel.id;
  }

  cancelLink() { this.linkFromId = null; }

  nodeClickTarget(id: string) {
    if (this.linkFromId && this.linkFromId !== id) {
      this.link(this.linkFromId, id);
      this.linkFromId = null;
    } else {
      this.selectById(id);
    }
  }

  // ---- Canvas panning (hand drag) ----
  onCanvasMouseDown(event: MouseEvent) {
    // Only start panning when clicking the empty canvas area (not on nodes/connectors)
    const target = event.target as HTMLElement;
    if (target.closest('.flow-node')) return;
    if (!this.canvasContainerRef) return;
    if (event.button !== 0) return; // left click only

    this.isPanning = true;
    this.panStart = { x: event.clientX, y: event.clientY };
    const el = this.canvasContainerRef.nativeElement;
    this.panScrollStart = { left: el.scrollLeft, top: el.scrollTop };
    event.preventDefault();
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.isPanning || !this.canvasContainerRef) return;
    const dx = event.clientX - this.panStart.x;
    const dy = event.clientY - this.panStart.y;
    const el = this.canvasContainerRef.nativeElement;
    el.scrollLeft = this.panScrollStart.left - dx;
    el.scrollTop = this.panScrollStart.top - dy;
    event.preventDefault();
  }

  onCanvasMouseUp() {
    this.isPanning = false;
  }

  // CRUD Operations
  editFlow(flow: AutomationFlow) {
    this.editingFlow = flow;
    this.name = flow.name;
    this.startNodeId = flow.startNodeId;
    
    // Load flow nodes into steps
    this.steps = flow.nodes.map(node => ({
      id: node.id,
      type: node.type,
      title: (node as any).title,
      templateId: (node as any).templateId,
      delayMs: (node as any).delayMs,
      next: node.next || [],
      pos: (node as any).pos || this.getNextPosition()
    }));
    
    this.selectedIndex = 0;
    this.updateConnections();
    this.snack.open(`Editing flow: ${flow.name}`, 'OK', { duration: 2000 });
  }

  deleteFlow(flow: AutomationFlow) {
    if (!flow._id) return;
    
    if (confirm(`Are you sure you want to delete "${flow.name}"?`)) {
      this.api.delete(flow._id).subscribe({
        next: () => {
          this.snack.open('Flow deleted', 'OK', { duration: 1500 });
          this.load();
        },
        error: () => this.snack.open('Delete failed', 'Dismiss', { duration: 2000 })
      });
    }
  }

  saveFlow() {
    const nodes = this.serialize();
    if (!nodes.length) { 
      this.snack.open('Add at least one step', 'OK', { duration: 1500 }); 
      return; 
    }

    this.saving = true;
    
    if (this.editingFlow) {
      // Update existing flow
      const updatedFlow = {
        ...this.editingFlow,
        name: this.name || 'Untitled Flow',
        startNodeId: this.startNodeId,
        nodes
      };
      
      this.api.update(this.editingFlow._id!, updatedFlow).subscribe({
        next: () => {
          this.snack.open('Flow updated', 'OK', { duration: 1500 });
          this.resetBuilder();
          this.load();
        },
        error: () => this.snack.open('Update failed', 'Dismiss', { duration: 2000 }),
        complete: () => this.saving = false
      });
    } else {
      // Create new flow
      const flow: AutomationFlow = { 
        name: this.name || 'Untitled Flow', 
        startNodeId: this.startNodeId, 
        nodes 
      } as any;
      
      this.api.create(flow).subscribe({
        next: () => {
          this.snack.open('Flow saved', 'OK', { duration: 1500 });
          this.resetBuilder();
          this.load();
        },
        error: () => this.snack.open('Save failed', 'Dismiss', { duration: 2000 }),
        complete: () => this.saving = false
      });
    }
  }

  private getNextPosition(): { x: number, y: number } {
    const count = this.steps.length;
    
    if (count === 0) {
      return { x: 150, y: 150 }; // Start position
    }
    
    // Linear flow: place nodes in a horizontal line with proper spacing
    const nodeWidth = 220;
    const horizontalGap = 100;
    const verticalOffset = 0;
    
    // Calculate position based on count
    const x = 150 + (count * (nodeWidth + horizontalGap));
    const y = 150 + verticalOffset;
    
    return { x, y };
  }

  private computeCanvasSizeFromManual() {
    // Calculate available canvas space based on sidebar states
    const leftSidebarWidth = this.leftSidebarOpen ? 350 : 0;
    const rightSidebarWidth = this.rightSidebarOpen ? 400 : 0;
    const toolbarHeight = 128; // Global navbar (64px) + Top toolbar (64px)
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculate available canvas dimensions
    const availableWidth = viewportWidth - leftSidebarWidth - rightSidebarWidth;
    const availableHeight = viewportHeight - toolbarHeight;
    
    // Calculate minimum canvas size based on nodes with extra padding for zoom
    let maxX = availableWidth, maxY = availableHeight;
    const zoomPadding = 500; // Extra space for zoomed content
    
    for (const s of this.steps) {
      const x = (s.pos?.x ?? 0) + this.nodeW + zoomPadding;
      const y = (s.pos?.y ?? 0) + this.nodeH + zoomPadding;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    
    // Ensure canvas is large enough for all zoom levels
    const minCanvasWidth = Math.max(availableWidth * 5, 2000); // 5x for zoom out
    const minCanvasHeight = Math.max(availableHeight * 5, 1500);
    
    this.canvasW = Math.max(minCanvasWidth, maxX);
    this.canvasH = Math.max(minCanvasHeight, maxY);
    this.viewBox = `0 0 ${this.canvasW} ${this.canvasH}`;
  }

  private generateId() {
    let i = this.steps.length + 1;
    while (this.steps.some(s => s.id === `n${i}`)) i++;
    return `n${i}`;
  }

  // Foblex Flow methods
  selectNode(id: string) {
    const index = this.steps.findIndex(s => s.id === id);
    if (index >= 0) {
      this.selectedIndex = index;
      // Ensure right sidebar is open when selecting a node
      if (!this.rightSidebarOpen) {
        this.rightSidebarOpen = true;
        // Recalculate canvas size after sidebar opens
        setTimeout(() => {
          this.computeCanvasSizeFromManual();
        }, 300);
      }
    }
  }

  onCreateConnection(event: any) {
    console.log('Create connection event:', event);
    if (!event.fInputId || !event.fOutputId) {
      return;
    }
    
    // Extract node IDs from connector IDs
    const fromNodeId = event.fOutputId.replace('_output', '').replace('_true', '').replace('_false', '');
    const toNodeId = event.fInputId.replace('_input', '');
    
    console.log('Connection from:', fromNodeId, 'to:', toNodeId);
    
    // Prevent self-connection
    if (fromNodeId === toNodeId) {
      return;
    }
    
    // Check if connection already exists between these nodes
    const existingConnection = this.connections.find(c => {
      const existingFromId = c.fOutputId.replace('_output', '').replace('_true', '').replace('_false', '');
      const existingToId = c.fInputId.replace('_input', '');
      return existingFromId === fromNodeId && existingToId === toNodeId;
    });
    
    if (existingConnection) {
      return; // Connection already exists
    }
    
    // Add the connection to our data model first
    this.link(fromNodeId, toNodeId);
    
    // Force immediate UI update
    this.updateConnections();
  }

  onFlowLoaded() {
    // Initialize the flow after it's loaded
    this.updateConnections();
  }

  getNodeIcon(type: string): string {
    switch (type) {
      case 'sendEmail': return 'mail';
      case 'wait': return 'schedule';
      case 'conditionReply': return 'call_received';
      case 'end': return 'stop_circle';
      default: return 'radio_button_unchecked';
    }
  }

  getNodeTypeLabel(type: string): string {
    switch (type) {
      case 'sendEmail': return 'Email';
      case 'wait': return 'Wait';
      case 'conditionReply': return 'Condition';
      case 'end': return 'End';
      default: return 'Unknown';
    }
  }

  getConnectionType(outputId: string, inputId: string): string {
    const fromNodeId = outputId.replace('_output', '').replace('_true', '').replace('_false', '');
    const toNodeId = inputId.replace('_input', '');
    
    const fromNode = this.steps.find(s => s.id === fromNodeId);
    const toNode = this.steps.find(s => s.id === toNodeId);
    
    if (!fromNode || !toNode) return 'bezier';
    
    const fromPos = fromNode.pos || { x: 0, y: 0 };
    const toPos = toNode.pos || { x: 0, y: 0 };
    
    const deltaX = Math.abs(toPos.x - fromPos.x);
    const deltaY = Math.abs(toPos.y - fromPos.y);
    
    // If nodes are mostly horizontal (side by side)
    if (deltaX > deltaY * 2) {
      return 'straight';
    }
    
    // If nodes are mostly vertical (above/below each other)
    if (deltaY > deltaX * 2) {
      return 'segment'; // Step-like connection for vertical alignment
    }
    
    // For diagonal or mixed positioning, use bezier curves
    return 'bezier';
  }

  openFlowsModal() {
    this.showFlowsModal = true;
  }

  closeFlowsModal() {
    this.showFlowsModal = false;
  }

  // Zoom functionality
  zoomIn() {
    console.log('🔍 Zoom In clicked');
    this.zoomLevel = Math.min(this.zoomLevel * 1.2, this.maxZoom);
    console.log('New zoom level:', this.zoomLevel);
  }

  zoomOut() {
    console.log('🔍 Zoom Out clicked');
    this.zoomLevel = Math.max(this.zoomLevel / 1.2, this.minZoom);
    console.log('New zoom level:', this.zoomLevel);
  }

  resetZoom() {
    console.log('🔍 Reset Zoom clicked');
    this.zoomLevel = 1;
    this.transformOrigin = 'center center';
    console.log('Zoom reset to:', this.zoomLevel);
  }

  onMouseWheel(event: WheelEvent) {
    console.log('🖱️ Mouse wheel event:', event.deltaY);
    event.preventDefault();
    event.stopPropagation();
    
    const zoomFactor = 0.1;
    
    // Get mouse position relative to canvas
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate zoom center as percentage of canvas
    const centerX = (mouseX / rect.width) * 100;
    const centerY = (mouseY / rect.height) * 100;
    
    // Update transform origin
    this.transformOrigin = `${centerX}% ${centerY}%`;
    
    if (event.deltaY < 0) {
      // Zoom in
      this.zoomLevel = Math.min(this.zoomLevel + zoomFactor, this.maxZoom);
      console.log('🔍 Mouse wheel zoom in:', this.zoomLevel);
    } else {
      // Zoom out
      this.zoomLevel = Math.max(this.zoomLevel - zoomFactor, this.minZoom);
      console.log('🔍 Mouse wheel zoom out:', this.zoomLevel);
    }
  }

  zoomOriginX = 50; // Default center
  zoomOriginY = 50; // Default center

  onNodePositionChange(event: any) {
    console.log('Node position change:', event);
    const nodeId = event.fNodeId;
    const position = event.fPosition;
    const step = this.steps.find(s => s.id === nodeId);
    if (step) {
      step.pos = position;
      this.updateConnections();
      this.computeCanvasSizeFromManual();
    }
  }

  onNodeMouseDown(event: MouseEvent, nodeId: string) {
    console.log('Node mouse down:', nodeId);
    event.stopPropagation();
  }

  onDragStart(event: DragEvent, nodeId: string) {
    console.log('Drag start:', nodeId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', nodeId);
    }
  }

  private isDragging = false;
  private dragOffset = { x: 0, y: 0 };
  private dragNodeId: string | null = null;

  startDrag(event: MouseEvent, nodeId: string) {
    console.log('Start drag:', nodeId);
    event.preventDefault();
    event.stopPropagation();
    
    this.isDragging = true;
    this.dragNodeId = nodeId;
    
    const nodeElement = event.target as HTMLElement;
    const nodeRect = nodeElement.getBoundingClientRect();
    const canvasRect = document.querySelector('.canvas-container')?.getBoundingClientRect();
    
    if (canvasRect) {
      this.dragOffset.x = event.clientX - nodeRect.left;
      this.dragOffset.y = event.clientY - nodeRect.top;
    }
    
    // Add global mouse event listeners
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging || !this.dragNodeId) return;
    
    event.preventDefault();
    const canvasRect = document.querySelector('.canvas-container')?.getBoundingClientRect();
    
    if (canvasRect) {
      const x = event.clientX - canvasRect.left - this.dragOffset.x;
      const y = event.clientY - canvasRect.top - this.dragOffset.y;
      
      const step = this.steps.find(s => s.id === this.dragNodeId);
      if (step) {
        step.pos = { 
          x: Math.max(0, Math.min(x, canvasRect.width - 220)), 
          y: Math.max(0, Math.min(y, canvasRect.height - 100)) 
        };
        this.updateConnections();
      }
    }
  }

  onMouseUp(event: MouseEvent) {
    if (this.isDragging) {
      console.log('Drag ended for:', this.dragNodeId);
      this.isDragging = false;
      this.dragNodeId = null;
      
      // Remove global event listeners
      document.removeEventListener('mousemove', this.onMouseMove.bind(this));
      document.removeEventListener('mouseup', this.onMouseUp.bind(this));
      
      this.computeCanvasSizeFromManual();
    }
  }

  // Connection creation methods
  public isConnecting = false;
  public connectionStart: { nodeId: string, type: 'input' | 'output' } | null = null;

  startConnection(event: MouseEvent, nodeId: string, type: 'input' | 'output') {
    console.log('🔵 Start connection:', nodeId, type);
    event.preventDefault();
    event.stopPropagation();
    
    // Start new connection
    this.isConnecting = true;
    this.connectionStart = { nodeId, type };
    this.linkFromId = nodeId; // Show visual feedback
    console.log('🟡 Connection started from:', nodeId, '- click on target node');
  }

  handleNodeClick(event: MouseEvent, nodeId: string) {
    console.log('🎯 Node clicked:', nodeId);
    
    // If we're in connection mode, complete the connection
    if (this.isConnecting && this.connectionStart && this.connectionStart.nodeId !== nodeId) {
      console.log('🟢 Completing connection from', this.connectionStart.nodeId, 'to', nodeId);
      this.createConnection(this.connectionStart.nodeId, nodeId);
      this.isConnecting = false;
      this.connectionStart = null;
      this.linkFromId = null;
      return;
    }
    
    // Otherwise, just select the node
    this.selectNode(nodeId);
  }

  onConnectorMouseUp(event: MouseEvent, nodeId: string, type: 'input' | 'output') {
    console.log('Connector mouse up:', nodeId, type);
    
    if (this.isConnecting && this.connectionStart) {
      if (this.connectionStart.type === 'output' && type === 'input') {
        // Create connection from output to input
        this.createConnection(this.connectionStart.nodeId, nodeId);
      }
      
      this.isConnecting = false;
      this.connectionStart = null;
    }
  }

  createConnection(fromNodeId: string, toNodeId: string) {
    console.log('Creating connection from:', fromNodeId, 'to:', toNodeId);
    
    if (fromNodeId === toNodeId) {
      console.log('Cannot connect node to itself');
      return;
    }
    
    // Check if connection already exists
    const exists = this.connections.find(c => 
      c.fOutputId === fromNodeId + '_output' && c.fInputId === toNodeId + '_input'
    );
    
    if (exists) {
      console.log('Connection already exists');
      return;
    }
    
    console.log('Adding new connection to array');
    this.connections.push({
      fOutputId: fromNodeId + '_output',
      fInputId: toNodeId + '_input'
    });
    
    console.log('Current connections:', this.connections);
    
    // Update data model
    this.link(fromNodeId, toNodeId);
    
    // Force UI update
    this.updateConnections();
    
    console.log('Connection created successfully');
  }

  getConnectionPath(connection: any): string {
    const fromNode = this.steps.find(s => s.id === connection.fOutputId.replace('_output', ''));
    const toNode = this.steps.find(s => s.id === connection.fInputId.replace('_input', ''));

    if (!fromNode || !toNode) return '';

    const fromPos = fromNode.pos || { x: 0, y: 0 };
    const toPos = toNode.pos || { x: 0, y: 0 };

    const nodeW = this.nodeW; // 220
    const nodeH = this.nodeH; // 100

    // Decide preferred sides based on relative placement
    const dx = (toPos.x + nodeW / 2) - (fromPos.x + nodeW / 2);
    const dy = (toPos.y + nodeH / 2) - (fromPos.y + nodeH / 2);
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let fromSide: 'left' | 'right' | 'top' | 'bottom';
    let toSide: 'left' | 'right' | 'top' | 'bottom';

    if (absDx > absDy * 1.3) {
      // Mostly horizontal
      if (dx >= 0) { fromSide = 'right'; toSide = 'left'; } else { fromSide = 'left'; toSide = 'right'; }
    } else if (absDy > absDx * 1.3) {
      // Mostly vertical
      if (dy >= 0) { fromSide = 'bottom'; toSide = 'top'; } else { fromSide = 'top'; toSide = 'bottom'; }
    } else {
      // Diagonal: choose major axis and bias control points
      if (dx >= 0) { fromSide = 'right'; toSide = absDy > absDx ? (dy >= 0 ? 'top' : 'bottom') : 'left'; }
      else { fromSide = 'left'; toSide = absDy > absDx ? (dy >= 0 ? 'top' : 'bottom') : 'right'; }
    }

    const getPointForSide = (pos: { x: number, y: number }, side: 'left'|'right'|'top'|'bottom') => {
      switch (side) {
        case 'left': return { x: pos.x, y: pos.y + nodeH / 2 };
        case 'right': return { x: pos.x + nodeW, y: pos.y + nodeH / 2 };
        case 'top': return { x: pos.x + nodeW / 2, y: pos.y };
        case 'bottom': return { x: pos.x + nodeW / 2, y: pos.y + nodeH };
      }
    };

    const p1 = getPointForSide(fromPos, fromSide);
    const p2 = getPointForSide(toPos, toSide);

    // Compute control points based on sides for a smooth curve
    const offset = 60 + Math.max(20, Math.min(200, Math.max(absDx, absDy) / 2));

    let c1 = { x: p1.x, y: p1.y };
    let c2 = { x: p2.x, y: p2.y };

    if (fromSide === 'right') c1.x += offset;
    if (fromSide === 'left') c1.x -= offset;
    if (fromSide === 'top') c1.y -= offset;
    if (fromSide === 'bottom') c1.y += offset;

    if (toSide === 'left') c2.x -= offset;
    if (toSide === 'right') c2.x += offset;
    if (toSide === 'top') c2.y -= offset;
    if (toSide === 'bottom') c2.y += offset;

    return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }

  private positionChangeTimeout: any;

  getInputSide(nodeId: string): 'left' | 'right' | 'top' | 'bottom' {
    const node = this.steps.find(s => s.id === nodeId);
    if (!node) return 'left';
    
    // Find nodes that connect TO this node
    const incomingNodes = this.steps.filter(s => 
      s.next?.some((n: any) => n.to === nodeId)
    );
    
    if (incomingNodes.length === 0) return 'left';
    
    const currentPos = node.pos || { x: 0, y: 0 };
    const fromNode = incomingNodes[0];
    const fromPos = fromNode.pos || { x: 0, y: 0 };
    
    const deltaX = currentPos.x - fromPos.x;
    const deltaY = currentPos.y - fromPos.y;
    
    // Determine which side the connection should come from
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'left' : 'right';
    } else {
      return deltaY > 0 ? 'top' : 'bottom';
    }
  }

  getOutputSide(nodeId: string): 'left' | 'right' | 'top' | 'bottom' {
    const node = this.steps.find(s => s.id === nodeId);
    if (!node || !node.next || node.next.length === 0) return 'right';
    
    // Find the first connected node
    const nextNodeId = node.next[0].to;
    const nextNode = this.steps.find(s => s.id === nextNodeId);
    if (!nextNode) return 'right';
    
    const currentPos = node.pos || { x: 0, y: 0 };
    const nextPos = nextNode.pos || { x: 0, y: 0 };
    
    const deltaX = nextPos.x - currentPos.x;
    const deltaY = nextPos.y - currentPos.y;
    
    // Determine which side the connection should go to
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'bottom' : 'top';
    }
  }

  private updateConnections() {
    this.connections = [];
    
    for (const step of this.steps) {
      if (step.next && Array.isArray(step.next)) {
        for (const next of step.next) {
          this.connections.push({
            fOutputId: `${step.id}_output`,
            fInputId: `${next.to}_input`
          });
        }
      }
    }
  }

  trackConnection(index: number, connection: any): string {
    return `${connection.fOutputId}-${connection.fInputId}`;
  }

  serialize() {
    const ids = new Set(this.steps.map(s => s.id));
    for (const s of this.steps) {
      if (Array.isArray(s.next)) {
        for (const e of s.next) if (!ids.has(e.to)) { this.snack.open(`Invalid link from ${s.id} -> ${e.to}`, 'Dismiss', { duration: 2000 }); return []; }
      }
    }
    return this.steps.map(s => ({
      id: s.id,
      type: s.type,
      title: s.title,
      templateId: s.templateId,
      delayMs: s.delayMs,
      next: s.next || [],
      pos: s.pos || { x: 0, y: 0 }
    }));
  }

  // Sidebar toggle methods
  toggleLeftSidebar() {
    this.leftSidebarOpen = !this.leftSidebarOpen;
    // Recalculate canvas size when sidebar toggles
    setTimeout(() => {
      this.computeCanvasSizeFromManual();
    }, 300); // Wait for animation to complete
  }

  toggleRightSidebar() {
    this.rightSidebarOpen = !this.rightSidebarOpen;
    // Recalculate canvas size when sidebar toggles
    setTimeout(() => {
      this.computeCanvasSizeFromManual();
    }, 300); // Wait for animation to complete
  }
}