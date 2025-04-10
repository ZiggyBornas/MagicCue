import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Cue } from '../types/project';
import pdfjs, { PDFDocumentType } from '../utils/pdfjs-setup';
import CueSpreadsheet from './CueSpreadsheet';

interface PDFViewerProps {
  onCueAdd: (cue: Omit<Cue, 'id'>) => void;
  onCueSelect: (cue: Cue) => void;
  onCueMove: (cueId: string, position: { x: number; y: number }) => void;
}

interface SceneHeading {
  pageNumber: number;
  title: string;
  description?: string;
  color?: string;
  isActStart?: boolean;
  isActEnd?: boolean;
  actNumber?: number;
}

interface ExtendedCue extends Cue {
  rotation?: number;
  lineLength?: number;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  onCueAdd,
  onCueSelect,
  onCueMove,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [cues, setCues] = useState<Cue[]>([]);
  const [selectedCue, setSelectedCue] = useState<Cue | null>(null);
  const [selectedCues, setSelectedCues] = useState<Cue[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [scale, setScale] = useState(1.5);
  const [isLoading, setIsLoading] = useState(true);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sceneHeadings, setSceneHeadings] = useState<SceneHeading[]>([]);
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newSceneDescription, setNewSceneDescription] = useState('');
  const [newSceneColor, setNewSceneColor] = useState('#3B82F6'); // Default blue
  const [activeView, setActiveView] = useState<'pdf' | 'spreadsheet'>('pdf');
  const [hoveredCue, setHoveredCue] = useState<Cue | null>(null);
  const [showSceneButton, setShowSceneButton] = useState(false);
  const [newSceneIsActStart, setNewSceneIsActStart] = useState(false);
  const [newSceneIsActEnd, setNewSceneIsActEnd] = useState(false);
  const [newSceneActNumber, setNewSceneActNumber] = useState<number | undefined>();
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [defaultCueType, setDefaultCueType] = useState<Cue['type']>('LX');
  const [defaultCueColor, setDefaultCueColor] = useState('#FF0000');
  const [snapDistance, setSnapDistance] = useState(120);
  const [snapThreshold, setSnapThreshold] = useState(3);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [showCueCounts, setShowCueCounts] = useState(true);
  const [thumbnailSize, setThumbnailSize] = useState('medium');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [showRulers, setShowRulers] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [autoNumberCues, setAutoNumberCues] = useState(true);
  const [showCueLabels, setShowCueLabels] = useState(true);
  const [cueSize, setCueSize] = useState('medium');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [confirmDelete, setConfirmDelete] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const projects = JSON.parse(localStorage.getItem('projects') || '[]');
        const project = projects.find((p: any) => p.id === id);
        
        if (project) {
          setPdfUrl(project.pdfUrl);
          setCues(project.cues || []);
          await loadPDF(project.pdfUrl);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      }
    };

    fetchProject();
  }, [id]);

  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(currentPage);
    }
  }, [currentPage, scale]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentPage(prev => Math.max(prev - 1, 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  const loadPDF = async (url: string) => {
    try {
      setIsLoading(true);
      const loadingTask = pdfjs.getDocument(url);
      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      
      // Generate thumbnails for all pages
      const images = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context!,
          viewport: viewport
        }).promise;
        
        images.push(canvas.toDataURL());
      }
      setPageImages(images);
      
      // Render first page
      await renderPage(1);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setIsLoading(false);
    }
  };

  const renderPage = async (pageNumber: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      const page = await pdfDocRef.current.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate viewport with padding for UI elements
      const viewport = page.getViewport({ scale: scale * 0.7 }); // Reduce scale further for binder layout
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Update container size to match canvas with additional padding
      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.width = `${viewport.width + 100}px`;
        pdfContainerRef.current.style.height = `${viewport.height + 100}px`;
      }

      await page.render({
        canvasContext: context!,
        viewport: viewport
      }).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleCueClick = (e: React.MouseEvent, cue: Cue) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey) {
      // Multi-select with shift
      if (selectedCues.includes(cue)) {
        setSelectedCues(selectedCues.filter(c => c.id !== cue.id));
        if (selectedCues.length === 1) {
          setSelectedCue(null);
        }
      } else {
        setSelectedCues([...selectedCues, cue]);
        setSelectedCue(cue);
      }
    } else {
      // Single select
      setSelectedCues([cue]);
      setSelectedCue(cue);
    }
    onCueSelect(cue);
  };

  const handleMouseDown = (e: React.MouseEvent, cue: ExtendedCue) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCue(cue);
    setIsDragging(true);
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - (rect.left + (rect.width * (cue.position.x / 100))),
        y: e.clientY - (rect.top + (rect.height * (cue.position.y / 100)))
      });
    }
  };

  const handleLineMouseDown = (e: React.MouseEvent, cue: ExtendedCue) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRotating(true);
    setSelectedCue(cue);
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (rect) {
      // Store the initial mouse position and current line length
      setDragOffset({
        x: e.clientX - rect.left,
        y: cue.lineLength || 100
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && !isRotating) return;
    if (!selectedCue || !pdfContainerRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = pdfContainerRef.current.getBoundingClientRect();
    
    if (isDragging) {
      const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      // Calculate snap position (120px from right edge in percentage)
      const snapPosition = ((rect.width - 120) / rect.width) * 100;
      const snapThreshold = 3; // 3% threshold for snapping
      
      let newX = x;
      if (Math.abs(x - snapPosition) < snapThreshold) {
        newX = snapPosition;
      }

      const clampedX = Math.max(0, Math.min(100, newX));
      const clampedY = Math.max(0, Math.min(100, y));

      const newPosition = { x: clampedX, y: clampedY };
      const updatedCue = { ...selectedCue, position: newPosition };
      setSelectedCue(updatedCue);
      
      // Update the cues array
      const updatedCues = cues.map(cue => 
        cue.id === selectedCue.id ? updatedCue : cue
      );
      setCues(updatedCues);
      onCueMove(selectedCue.id, newPosition);
    } else if (isRotating) {
      // Calculate the new line length based on the difference from the initial position
      const mouseX = e.clientX - rect.left;
      const initialX = dragOffset.x;
      const currentLength = dragOffset.y;
      const deltaX = initialX - mouseX; // Fixed: use initialX - mouseX for proper direction
      
      // Calculate new length, ensuring it stays within bounds
      const newLineLength = Math.max(50, Math.min(500, currentLength + deltaX));
      
      const updatedCue = { ...selectedCue, lineLength: newLineLength };
      setSelectedCue(updatedCue);
      
      // Update the cues array
      const updatedCues = cues.map(cue => 
        cue.id === selectedCue.id ? updatedCue : cue
      );
      setCues(updatedCues);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsRotating(false);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleCueMove = (cueId: string, position: { x: number; y: number }) => {
    const updatedCues = cues.map(cue => 
      cue.id === cueId ? { ...cue, position } : cue
    );
    setCues(updatedCues);
    onCueMove(cueId, position);
    saveProject(updatedCues);
  };

  const handleCueAdd = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging || isRotating) return;
    if (!canvasRef.current || !pdfDocRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the relative position as a percentage
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Get next cue number if auto-numbering is enabled
    const nextNumber = autoNumberCues 
      ? Math.max(...cues.map(c => c.number), 0) + 1 
      : cues.length + 1;

    const newCue: Cue = {
      id: Date.now().toString(),
      type: defaultCueType,
      number: nextNumber,
      label: '',
      position: { x, y },
      color: defaultCueColor,
      page: currentPage,
      time: '',
      notes: ''
    };

    const updatedCues = [...cues, newCue];
    setCues(updatedCues);
    setSelectedCue(newCue);
    setSelectedCues([newCue]);
    
    if (autoSave) {
      saveProject(updatedCues);
    }
  };

  const handleCueUpdate = (updatedCue: Cue) => {
    setCues(prevCues => {
      const updatedCues = prevCues.map(cue => 
        cue.id === updatedCue.id ? updatedCue : cue
      );
      // Save the updated cues
      saveProject(updatedCues);
      return updatedCues;
    });
    // Update the selected cue if it's the one being edited
    if (selectedCue?.id === updatedCue.id) {
      setSelectedCue(updatedCue);
    }
  };

  const handleCueDelete = (cueId: string) => {
    const deleteCue = () => {
      const updatedCues = cues.filter(cue => cue.id !== cueId);
      setCues(updatedCues);
      if (selectedCue?.id === cueId) {
        setSelectedCue(null);
      }
      if (autoSave) {
        saveProject(updatedCues);
      }
    };

    if (confirmDelete) {
      if (window.confirm('Are you sure you want to delete this cue?')) {
        deleteCue();
      }
    } else {
      deleteCue();
    }
  };

  const handleDeleteSelected = () => {
    if (selectedCues.length === 0) return;
    
    const updatedCues = cues.filter(cue => !selectedCues.some(selected => selected.id === cue.id));
    setCues(updatedCues);
    setSelectedCue(null);
    setSelectedCues([]);
  };

  // Add keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedCues.length > 0) {
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCues]);

  const saveProject = (updatedCues: Cue[]) => {
    const projects = JSON.parse(localStorage.getItem('projects') || '[]');
    const updatedProjects = projects.map((p: any) => 
      p.id === id ? { ...p, cues: updatedCues, updatedAt: new Date().toISOString() } : p
    );
    localStorage.setItem('projects', JSON.stringify(updatedProjects));
  };

  const renderCueMarkers = () => {
    return (
      <>
        {/* Invisible snap line */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: 'calc(100% - 120px)',
            width: '1px',
            backgroundColor: 'transparent',
            pointerEvents: 'none'
          }}
        />
        
        {cues
          .filter(cue => cue.page === currentPage)
          .map(cue => {
            const extendedCue = cue as ExtendedCue;
            const lineLength = extendedCue.lineLength || 100;
            const isSelected = selectedCues.some(c => c.id === cue.id);
            
            return (
              <div
                key={cue.id}
                className={`absolute cursor-move group cue-marker ${
                  isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                }`}
                style={{
                  left: `${cue.position.x}%`,
                  top: `${cue.position.y}%`,
                  transform: 'translate(0, -50%)',
                  zIndex: isSelected ? 50 : 10
                }}
                onClick={(e) => handleCueClick(e, cue)}
                onMouseDown={(e) => handleMouseDown(e, extendedCue)}
              >
                {/* Cue label box on the right */}
                <div
                  className={`w-16 h-6 ${getColorClass(cue.color)} transform relative border border-gray-800 flex items-center justify-center group-hover:ring-2 group-hover:ring-offset-1 group-hover:ring-blue-300`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <span className="text-white font-medium text-sm">
                    {cue.type}{cue.number}
                  </span>

                  {/* Hover tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white/90 px-2 py-1 rounded shadow-md text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    {cue.label}
                    {cue.time && <span className="text-gray-500 ml-1">• {cue.time}</span>}
                    {cue.notes && (
                      <div className="text-gray-500 mt-1 max-w-xs break-words">
                        {cue.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Empty box and line container */}
                <div 
                  className="absolute right-full top-0 bottom-0 flex items-center"
                  style={{ width: `${lineLength}px` }}
                >
                  {/* Empty box on the left */}
                  <div 
                    className="w-6 h-6 border border-gray-800 bg-transparent flex items-center justify-center cursor-ew-resize relative"
                    onMouseDown={(e) => handleLineMouseDown(e, extendedCue)}
                  >
                    {/* Horizontal line at the bottom */}
                    <div
                      className="h-px bg-gray-800 cursor-ew-resize origin-left absolute bottom-0 left-0 right-0"
                      style={{
                        width: `${lineLength}px`,
                      }}
                      onMouseDown={(e) => handleLineMouseDown(e, extendedCue)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </>
    );
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-500';
      case 'red': return 'bg-red-500';
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'purple': return 'bg-purple-500';
      case 'orange': return 'bg-orange-500';
      case 'pink': return 'bg-pink-500';
      case 'gray': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Update iframe src to show the new page
    const iframe = document.querySelector('iframe');
    if (iframe) {
      const currentSrc = iframe.src;
      const baseUrl = currentSrc.split('#')[0];
      iframe.src = `${baseUrl}#page=${pageNumber}`;
    }
  };

  const handleAddSceneHeading = () => {
    if (newSceneTitle.trim()) {
      const newScene: SceneHeading = {
        pageNumber: currentPage,
        title: newSceneTitle.trim(),
        description: newSceneDescription.trim() || undefined,
        color: newSceneColor,
        isActStart: newSceneIsActStart,
        isActEnd: newSceneIsActEnd,
        actNumber: newSceneActNumber
      };
      setSceneHeadings([...sceneHeadings, newScene]);
      setNewSceneTitle('');
      setNewSceneDescription('');
      setNewSceneColor('#3B82F6');
      setNewSceneIsActStart(false);
      setNewSceneIsActEnd(false);
      setNewSceneActNumber(undefined);
      setIsAddingScene(false);
      
      // Save scene headings to localStorage
      const projectData = JSON.parse(localStorage.getItem('projects') || '[]');
      const updatedProjects = projectData.map((p: any) =>
        p.id === id ? { ...p, sceneHeadings: [...sceneHeadings, newScene] } : p
      );
      localStorage.setItem('projects', JSON.stringify(updatedProjects));
    }
  };

  const renderPageTimeline = () => {
    return (
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900/80 backdrop-blur-sm overflow-y-auto">
        <div className="flex flex-col space-y-2 p-2">
          {pageImages.map((imageUrl, index) => {
            const pageNum = index + 1;
            const pageCues = cues.filter(cue => cue.page === pageNum);
            const pageScene = sceneHeadings.find(scene => scene.pageNumber === pageNum);
            
            return (
              <div
                key={pageNum}
                className={`relative group cursor-pointer transition-all ${
                  currentPage === pageNum ? 'scale-105 ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handlePageChange(pageNum)}
              >
                {/* Scene Header */}
                {pageScene && (
                  <div className="mb-1.5">
                    <div 
                      className={`bg-white/95 backdrop-blur-sm rounded-md shadow-lg overflow-hidden border-l-4 ${
                        pageScene.isActStart ? 'ring-1 ring-yellow-500' : ''
                      } ${
                        pageScene.isActEnd ? 'ring-1 ring-yellow-500' : ''
                      }`}
                      style={{ borderLeftColor: pageScene.color || '#3B82F6' }}
                    >
                      <div className="px-3 py-1.5">
                        <div className="flex items-center space-x-2">
                          {pageScene.actNumber && (
                            <span className="font-semibold text-yellow-600 text-xs">Act {pageScene.actNumber}</span>
                          )}
                          <h4 className="font-medium text-gray-900 text-sm">{pageScene.title}</h4>
                        </div>
                        {pageScene.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{pageScene.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Page Card */}
                <div
                  className={`relative rounded-md overflow-hidden transition-all duration-200 cursor-pointer ${
                    currentPage === pageNum 
                      ? 'ring-2 ring-blue-500 shadow-lg' 
                      : 'ring-1 ring-white/10 hover:ring-white/30'
                  }`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  <div className={`relative ${
                    thumbnailSize === 'small' ? 'aspect-[8.5/11] w-24' :
                    thumbnailSize === 'medium' ? 'aspect-[8.5/11] w-32' :
                    'aspect-[8.5/11] w-40'
                  }`}>
                    <img 
                      src={imageUrl} 
                      alt={`Page ${pageNum}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Overlay with page info */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50">
                      {/* Top bar */}
                      <div className="absolute top-0 left-0 right-0 p-1.5 flex items-center justify-between">
                        {showPageNumbers && (
                          <div className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                            Page {pageNum}
                          </div>
                        )}
                        {showCueCounts && pageCues.length > 0 && (
                          <div className="bg-blue-500/90 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            {pageCues.length} {pageCues.length === 1 ? 'cue' : 'cues'}
                          </div>
                        )}
                      </div>

                      {/* Scene badge */}
                      {pageScene && (
                        <div className="absolute bottom-1.5 left-1.5 right-1.5">
                          <div 
                            className={`bg-white/95 text-xs px-2 py-1 rounded shadow-md border-l-2 ${
                              pageScene.isActStart || pageScene.isActEnd ? 'border-yellow-500' : ''
                            }`}
                            style={{ borderLeftColor: pageScene.color || '#3B82F6' }}
                          >
                            <div className="flex items-center space-x-1.5">
                              {pageScene.actNumber && (
                                <span className="font-semibold text-yellow-600 text-[10px]">A{pageScene.actNumber}</span>
                              )}
                              <span className="font-medium text-gray-900 truncate text-[10px]">
                                {pageScene.title}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add Scene Button */}
                {currentPage === pageNum && !pageScene && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingScene(true);
                    }}
                    className="absolute left-1/2 -translate-x-1/2 top-2 bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-full shadow-lg transition-all duration-200 whitespace-nowrap z-50 flex items-center space-x-2 group"
                  >
                    <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Scene</span>
                  </button>
                )}

                {/* Scene Adding Form */}
                {currentPage === pageNum && isAddingScene && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 bg-black/50 z-[100]"
                      onClick={() => setIsAddingScene(false)}
                    />
                    
                    {/* Modal */}
                    <div 
                      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl z-[101] w-96 animate-fade-in"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">Add New Scene</h3>
                        <p className="text-sm text-gray-500">Page {currentPage}</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scene Title</label>
                          <input
                            type="text"
                            value={newSceneTitle}
                            onChange={e => setNewSceneTitle(e.target.value)}
                            placeholder="e.g., Scene 1: Opening"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                          <textarea
                            value={newSceneDescription}
                            onChange={e => setNewSceneDescription(e.target.value)}
                            placeholder="Brief description of the scene..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none h-20"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scene Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={newSceneColor}
                              onChange={e => setNewSceneColor(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer"
                            />
                            <span className="text-sm text-gray-500">Choose a color for the scene marker</span>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Act Management</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newSceneIsActStart}
                                onChange={e => {
                                  setNewSceneIsActStart(e.target.checked);
                                  if (e.target.checked && !newSceneActNumber) {
                                    setNewSceneActNumber(1);
                                  }
                                }}
                                className="rounded text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Start of Act</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newSceneIsActEnd}
                                onChange={e => setNewSceneIsActEnd(e.target.checked)}
                                className="rounded text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">End of Act</span>
                            </div>
                            {(newSceneIsActStart || newSceneIsActEnd) && (
                              <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-700">Act Number:</label>
                                <input
                                  type="number"
                                  value={newSceneActNumber || ''}
                                  onChange={e => setNewSceneActNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                                  min="1"
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 mt-6">
                        <button
                          onClick={() => setIsAddingScene(false)}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSceneHeading}
                          disabled={!newSceneTitle.trim()}
                          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Scene
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Hover preview */}
                <div className="fixed left-64 top-1/2 -translate-y-1/2 ml-4 bg-white p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <img 
                    src={imageUrl} 
                    alt={`Page ${pageNum} preview`}
                    className="w-96 h-auto"
                  />
                  {pageScene && (
                    <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-sm py-1 px-2 rounded">
                      {pageScene.title}
                    </div>
                  )}
                  {pageCues.length > 0 && (
                    <div className="absolute bottom-2 right-2 bg-gray-900/90 text-white text-sm py-1 px-2 rounded">
                      {pageCues.length} cues
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Add mouse move handler for the PDF container
  const handlePDFContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const containerRect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - containerRect.top;
    
    // Show button when mouse is within 100px of the top
    setShowSceneButton(mouseY < 100);
  };

  return (
    <div 
      className="flex flex-col h-screen bg-gray-100 select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Navigation Bar */}
      <div className="bg-white shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Projects</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="text-gray-600 hover:text-gray-900"
              disabled={scale <= 0.5}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm text-gray-600">{Math.round(scale * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="text-gray-600 hover:text-gray-900"
              disabled={scale >= 3}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveView('pdf')}
            className={`px-4 py-2 text-sm font-medium ${
              activeView === 'pdf'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            PDF View
          </button>
          <button
            onClick={() => setActiveView('spreadsheet')}
            className={`px-4 py-2 text-sm font-medium ${
              activeView === 'spreadsheet'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Spreadsheet View
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Page Timeline */}
        {activeView === 'pdf' && (
          <div 
            className="bg-gray-900/95 backdrop-blur-sm overflow-y-auto border-r border-gray-200 transition-all duration-300"
            style={{ width: `${sidebarWidth}px` }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-lg font-semibold">Pages</h3>
                <div className="flex items-center space-x-2">
                  {!sceneHeadings.find(scene => scene.pageNumber === currentPage) && (
                    <button
                      onClick={() => setIsAddingScene(true)}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Scene</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSidebarWidth(sidebarWidth === 320 ? 480 : 320)}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {pageImages.map((imageUrl, index) => {
                  const pageNum = index + 1;
                  const pageCues = cues.filter(cue => cue.page === pageNum);
                  const pageScene = sceneHeadings.find(scene => scene.pageNumber === pageNum);
                  
                  return (
                    <div
                      key={pageNum}
                      className={`group relative transition-all duration-200 ${
                        currentPage === pageNum ? 'scale-[1.02]' : ''
                      }`}
                    >
                      {/* Scene Header */}
                      {pageScene && (
                        <div className="mb-1.5">
                          <div 
                            className={`bg-white/95 backdrop-blur-sm rounded-md shadow-lg overflow-hidden border-l-4 ${
                              pageScene.isActStart ? 'ring-1 ring-yellow-500' : ''
                            } ${
                              pageScene.isActEnd ? 'ring-1 ring-yellow-500' : ''
                            }`}
                            style={{ borderLeftColor: pageScene.color || '#3B82F6' }}
                          >
                            <div className="px-3 py-1.5">
                              <div className="flex items-center space-x-2">
                                {pageScene.actNumber && (
                                  <span className="font-semibold text-yellow-600 text-xs">Act {pageScene.actNumber}</span>
                                )}
                                <h4 className="font-medium text-gray-900 text-sm">{pageScene.title}</h4>
                              </div>
                              {pageScene.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{pageScene.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Page Card */}
                      <div
                        className={`relative rounded-md overflow-hidden transition-all duration-200 cursor-pointer ${
                          currentPage === pageNum 
                            ? 'ring-2 ring-blue-500 shadow-lg' 
                            : 'ring-1 ring-white/10 hover:ring-white/30'
                        }`}
                        onClick={() => handlePageChange(pageNum)}
                      >
                        <div className={`relative ${
                          thumbnailSize === 'small' ? 'aspect-[8.5/11] w-24' :
                          thumbnailSize === 'medium' ? 'aspect-[8.5/11] w-32' :
                          'aspect-[8.5/11] w-40'
                        }`}>
                          <img 
                            src={imageUrl} 
                            alt={`Page ${pageNum}`}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          
                          {/* Overlay with page info */}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50">
                            {/* Top bar */}
                            <div className="absolute top-0 left-0 right-0 p-1.5 flex items-center justify-between">
                              {showPageNumbers && (
                                <div className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                  Page {pageNum}
                                </div>
                              )}
                              {showCueCounts && pageCues.length > 0 && (
                                <div className="bg-blue-500/90 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                  {pageCues.length} {pageCues.length === 1 ? 'cue' : 'cues'}
                                </div>
                              )}
                            </div>

                            {/* Scene badge */}
                            {pageScene && (
                              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                                <div 
                                  className={`bg-white/95 text-xs px-2 py-1 rounded shadow-md border-l-2 ${
                                    pageScene.isActStart || pageScene.isActEnd ? 'border-yellow-500' : ''
                                  }`}
                                  style={{ borderLeftColor: pageScene.color || '#3B82F6' }}
                                >
                                  <div className="flex items-center space-x-1.5">
                                    {pageScene.actNumber && (
                                      <span className="font-semibold text-yellow-600 text-[10px]">A{pageScene.actNumber}</span>
                                    )}
                                    <span className="font-medium text-gray-900 truncate text-[10px]">
                                      {pageScene.title}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Center - PDF Viewer or Spreadsheet */}
        <div className="flex-1 relative overflow-auto">
          {activeView === 'pdf' ? (
            pdfUrl ? (
              <div 
                ref={pdfContainerRef}
                className="pdf-container relative mx-auto my-8 bg-white shadow-xl rounded-lg overflow-hidden"
                onMouseMove={handlePDFContainerMouseMove}
                onMouseLeave={() => setShowSceneButton(false)}
                style={{ 
                  backgroundImage: showGrid ? `
                    linear-gradient(to right, #ddd 1px, transparent 1px),
                    linear-gradient(to bottom, #ddd 1px, transparent 1px)
                  ` : 'none',
                  backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : 'auto'
                }}
              >
                {showRulers && (
                  <>
                    <div className="absolute top-0 left-0 w-full h-6 bg-gray-100 border-b">
                      {/* Horizontal ruler markings */}
                      {Array.from({ length: Math.ceil(canvasRef.current?.width || 0) / 50 }).map((_, i) => (
                        <div key={i} className="absolute h-full border-l border-gray-300" style={{ left: `${i * 50}px` }}>
                          <span className="text-xs text-gray-500 ml-1">{i * 50}</span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-0 left-0 w-6 h-full bg-gray-100 border-r">
                      {/* Vertical ruler markings */}
                      {Array.from({ length: Math.ceil(canvasRef.current?.height || 0) / 50 }).map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-gray-300" style={{ top: `${i * 50}px` }}>
                          <span className="text-xs text-gray-500 ml-1">{i * 50}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <canvas
                  ref={canvasRef}
                  className="pdf-canvas cursor-crosshair"
                  onClick={handleCueAdd}
                  style={{ touchAction: 'none' }}
                />
                {renderCueMarkers()}
                
                {/* Scene Adding Button - Only show when hovering near top */}
                {showSceneButton && !sceneHeadings.find(scene => scene.pageNumber === currentPage) && (
                  <div 
                    className="absolute top-4 left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out transform opacity-100 z-50"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddingScene(true);
                      }}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2 group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Scene</span>
                    </button>
                  </div>
                )}

                {/* Scene Adding Form Modal */}
                {isAddingScene && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 bg-black/50 z-[100]"
                      onClick={() => setIsAddingScene(false)}
                    />
                    
                    {/* Modal */}
                    <div 
                      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl z-[101] w-96 animate-fade-in"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1">Add New Scene</h3>
                        <p className="text-sm text-gray-500">Page {currentPage}</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scene Title</label>
                          <input
                            type="text"
                            value={newSceneTitle}
                            onChange={e => setNewSceneTitle(e.target.value)}
                            placeholder="e.g., Scene 1: Opening"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                          <textarea
                            value={newSceneDescription}
                            onChange={e => setNewSceneDescription(e.target.value)}
                            placeholder="Brief description of the scene..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none h-20"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scene Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={newSceneColor}
                              onChange={e => setNewSceneColor(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer"
                            />
                            <span className="text-sm text-gray-500">Choose a color for the scene marker</span>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Act Management</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newSceneIsActStart}
                                onChange={e => {
                                  setNewSceneIsActStart(e.target.checked);
                                  if (e.target.checked && !newSceneActNumber) {
                                    setNewSceneActNumber(1);
                                  }
                                }}
                                className="rounded text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Start of Act</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newSceneIsActEnd}
                                onChange={e => setNewSceneIsActEnd(e.target.checked)}
                                className="rounded text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">End of Act</span>
                            </div>
                            {(newSceneIsActStart || newSceneIsActEnd) && (
                              <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-700">Act Number:</label>
                                <input
                                  type="number"
                                  value={newSceneActNumber || ''}
                                  onChange={e => setNewSceneActNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                                  min="1"
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 mt-6">
                        <button
                          onClick={() => setIsAddingScene(false)}
                          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddSceneHeading}
                          disabled={!newSceneTitle.trim()}
                          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Add Scene
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading PDF...</p>
              </div>
            )
          ) : (
            <CueSpreadsheet 
              cues={cues} 
              onCueSelect={onCueSelect} 
              onCueUpdate={handleCueUpdate}
            />
          )}
        </div>

        {/* Right Sidebar - Split into Cue Management and Settings */}
        <div className="w-96 bg-white border-l overflow-y-auto shadow-lg flex flex-col">
          {/* Cue Management Section */}
          <div className="flex-1 p-6 border-b">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Cue Management</h3>
              <div className="text-sm text-gray-500">
                {cues.length} cues
              </div>
            </div>
            
            {selectedCue ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-6 h-6 ${getColorClass(selectedCue.color)} rounded`} />
                    <span className="font-medium">{selectedCue.type}{selectedCue.number}</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cue Number</label>
                      <input
                        type="number"
                        value={selectedCue.number}
                        onChange={(e) => handleCueUpdate({ ...selectedCue, number: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={selectedCue.type}
                        onChange={(e) => handleCueUpdate({ ...selectedCue, type: e.target.value as Cue['type'] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="LX">Lighting (LX)</option>
                        <option value="SFX">Sound Effects (SFX)</option>
                        <option value="VIDEO">Video</option>
                        <option value="PROPS">Props</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedCue.label}
                        onChange={(e) => handleCueUpdate({ ...selectedCue, label: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="text"
                        value={selectedCue.time}
                        onChange={(e) => handleCueUpdate({ ...selectedCue, time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={selectedCue.notes}
                        onChange={(e) => handleCueUpdate({ ...selectedCue, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                      <div className="grid grid-cols-4 gap-2">
                        {['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'gray'].map((color) => (
                          <button
                            key={color}
                            onClick={() => handleCueUpdate({ ...selectedCue, color })}
                            className={`h-8 rounded-md ${getColorClass(color)} ${
                              selectedCue.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCueDelete(selectedCue.id)}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                >
                  Delete Cue
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-gray-500 mb-2">Click anywhere on the PDF to add a cue</p>
                <p className="text-sm text-gray-400">Drag cues to reposition them</p>
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className={`p-6 bg-gray-50 transition-all duration-300 ${
            isSettingsExpanded ? 'h-auto' : 'h-16'
          }`}>
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            >
              <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
              <button className="text-gray-500 hover:text-gray-700 transition-colors">
                <svg 
                  className={`w-5 h-5 transform transition-transform ${isSettingsExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {isSettingsExpanded && (
              <div className="mt-6 space-y-6 overflow-y-auto max-h-[calc(100vh-20rem)]">
                {/* Cue Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Cue Settings</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Cue Type</label>
                    <select
                      value={defaultCueType}
                      onChange={e => setDefaultCueType(e.target.value as Cue['type'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="LX">Lighting (LX)</option>
                      <option value="SFX">Sound Effects (SFX)</option>
                      <option value="VIDEO">Video</option>
                      <option value="PROPS">Props</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Cue Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={defaultCueColor}
                        onChange={e => setDefaultCueColor(e.target.value)}
                        className="w-12 h-8 rounded cursor-pointer"
                      />
                      <span className="text-sm text-gray-500">{defaultCueColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cue Size</label>
                    <div className="flex items-center space-x-4">
                      {['small', 'medium', 'large'].map(size => (
                        <button
                          key={size}
                          onClick={() => setCueSize(size)}
                          className={`px-3 py-1.5 text-sm rounded-md ${
                            cueSize === size
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={autoNumberCues}
                        onChange={e => setAutoNumberCues(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Auto-number new cues</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showCueLabels}
                        onChange={e => setShowCueLabels(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show cue labels</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={confirmDelete}
                        onChange={e => setConfirmDelete(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Confirm before deleting</span>
                    </label>
                  </div>
                </div>

                {/* Layout Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Layout Settings</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Size</label>
                    <div className="flex items-center space-x-4">
                      {['small', 'medium', 'large'].map(size => (
                        <button
                          key={size}
                          onClick={() => setThumbnailSize(size)}
                          className={`px-3 py-1.5 text-sm rounded-md ${
                            thumbnailSize === size
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showPageNumbers}
                        onChange={e => setShowPageNumbers(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show page numbers</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showCueCounts}
                        onChange={e => setShowCueCounts(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show cue counts</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={e => setShowGrid(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show grid</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={showRulers}
                        onChange={e => setShowRulers(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Show rulers</span>
                    </label>
                  </div>
                  {showGrid && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grid Size</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="range"
                          min="10"
                          max="50"
                          value={gridSize}
                          onChange={e => setGridSize(parseInt(e.target.value))}
                          className="w-full"
                        />
                        <span className="text-sm text-gray-500 w-12">{gridSize}px</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Snap Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b pb-2">Snap Settings</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Snap Distance (px)</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="60"
                        max="200"
                        value={snapDistance}
                        onChange={e => setSnapDistance(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-sm text-gray-500 w-12">{snapDistance}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Snap Threshold (%)</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={snapThreshold}
                        onChange={e => setSnapThreshold(parseInt(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-sm text-gray-500 w-8">{snapThreshold}%</span>
                    </div>
                  </div>
                </div>

                {/* General Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b pb-2">General Settings</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={autoSave}
                        onChange={e => setAutoSave(e.target.checked)}
                        className="rounded text-blue-500 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Auto-save changes</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Theme</label>
                    <div className="flex items-center space-x-4">
                      {['light', 'dark'].map(t => (
                        <button
                          key={t}
                          onClick={() => setTheme(t as 'light' | 'dark')}
                          className={`px-3 py-1.5 text-sm rounded-md ${
                            theme === t
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewer; 