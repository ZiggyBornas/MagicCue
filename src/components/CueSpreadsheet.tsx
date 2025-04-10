import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Cue } from '../types/project';

interface CueSpreadsheetProps {
  cues: Cue[];
  onCueSelect: (cue: Cue) => void;
  onCueUpdate: (cue: Cue) => void;
}

type SortKey = keyof Cue;
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface EditingCell {
  cueId: string;
  field: keyof Cue;
  rowIndex: number;
  colIndex: number;
}

const CueSpreadsheet: React.FC<CueSpreadsheetProps> = ({ cues, onCueSelect, onCueUpdate }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const sortedCues = useMemo(() => {
    if (!sortConfig) return cues;

    return [...cues].sort((a, b) => {
      // Always keep cue numbers in ascending order
      if (sortConfig.key === 'number') {
        return a.number - b.number;
      }

      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) {
        return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'ascending'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortConfig.direction === 'ascending'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
  }, [cues, sortConfig]);

  const columns: { key: keyof Cue; label: string; type: 'text' | 'number' | 'select' | 'color' }[] = [
    { key: 'type', label: 'Type', type: 'select' },
    { key: 'number', label: 'Number', type: 'number' },
    { key: 'page', label: 'Page', type: 'number' },
    { key: 'label', label: 'Label', type: 'text' },
    { key: 'time', label: 'Time', type: 'text' },
    { key: 'color', label: 'Color', type: 'color' },
  ];

  const handleCellClick = (cue: Cue, field: keyof Cue, rowIndex: number, colIndex: number) => {
    setEditingCell({ cueId: cue.id, field, rowIndex, colIndex });
    setEditValue(String(cue[field]));
    setTimeout(() => {
      if (field === 'type') {
        selectRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    }, 0);
  };

  const moveToNextCell = (direction: 'right' | 'left' | 'up' | 'down') => {
    if (!editingCell) return;

    const { rowIndex, colIndex } = editingCell;
    let newRowIndex = rowIndex;
    let newColIndex = colIndex;

    switch (direction) {
      case 'right':
        newColIndex = (colIndex + 1) % columns.length;
        break;
      case 'left':
        newColIndex = (colIndex - 1 + columns.length) % columns.length;
        break;
      case 'down':
        newRowIndex = Math.min(rowIndex + 1, sortedCues.length - 1);
        break;
      case 'up':
        newRowIndex = Math.max(rowIndex - 1, 0);
        break;
    }

    const nextCue = sortedCues[newRowIndex];
    const nextField = columns[newColIndex].key;
    handleCellClick(nextCue, nextField, newRowIndex, newColIndex);
  };

  const handleEditSubmit = () => {
    if (!editingCell) return;

    const cue = cues.find(c => c.id === editingCell.cueId);
    if (!cue) return;

    let processedValue: any = editValue;
    switch (editingCell.field) {
      case 'number':
      case 'page':
        processedValue = Number(editValue);
        break;
      case 'position':
        try {
          processedValue = JSON.parse(editValue);
        } catch {
          processedValue = cue.position;
        }
        break;
      default:
        processedValue = editValue;
    }

    const updatedCue = {
      ...cue,
      [editingCell.field]: processedValue
    };

    onCueUpdate(updatedCue);
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleEditSubmit();
        break;
      case 'Escape':
        e.preventDefault();
        setEditingCell(null);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          moveToNextCell('left');
        } else {
          moveToNextCell('right');
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveToNextCell('right');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveToNextCell('left');
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveToNextCell('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveToNextCell('down');
        break;
    }
  };

  const getTypeColor = (type: Cue['type']) => {
    switch (type) {
      case 'LX':
        return 'bg-blue-100 text-blue-800';
      case 'SFX':
        return 'bg-green-100 text-green-800';
      case 'VIDEO':
        return 'bg-purple-100 text-purple-800';
      case 'PROPS':
        return 'bg-yellow-100 text-yellow-800';
      case 'OTHER':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig?.key === key && sortConfig?.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) {
      return '↕️';
    }
    return sortConfig?.direction === 'ascending' ? '↑' : '↓';
  };

  const renderCell = (cue: Cue, field: keyof Cue, rowIndex: number, colIndex: number) => {
    const isEditing = editingCell?.cueId === cue.id && editingCell.field === field;
    const column = columns.find(col => col.key === field);

    if (isEditing) {
      switch (column?.type) {
        case 'select':
          return (
            <select
              ref={selectRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border rounded bg-white"
            >
              <option value="LX">LX</option>
              <option value="SFX">SFX</option>
              <option value="VIDEO">VIDEO</option>
              <option value="PROPS">PROPS</option>
              <option value="OTHER">OTHER</option>
            </select>
          );
        case 'number':
          return (
            <input
              ref={inputRef}
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border rounded bg-white"
            />
          );
        case 'color':
          return (
            <input
              ref={inputRef}
              type="color"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="w-full h-8"
            />
          );
        default:
          return (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="w-full px-2 py-1 border rounded bg-white"
            />
          );
      }
    }

    const formatValue = (value: any) => {
      if (value === undefined || value === null) return '';
      if (field === 'position') return JSON.stringify(value);
      if (field === 'number' || field === 'page') return String(value);
      return String(value);
    };

    switch (field) {
      case 'type':
        return (
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(cue.type)} cursor-pointer`}
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(cue, field, rowIndex, colIndex);
            }}
          >
            {cue.type}
          </span>
        );
      case 'color':
        return (
          <div
            className="w-4 h-4 rounded-full cursor-pointer"
            style={{ backgroundColor: cue.color }}
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(cue, field, rowIndex, colIndex);
            }}
          />
        );
      default:
        return (
          <span
            className="text-sm text-gray-900 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleCellClick(cue, field, rowIndex, colIndex);
            }}
          >
            {formatValue(cue[field])}
          </span>
        );
    }
  };

  const downloadCSV = () => {
    const headers = columns.map(col => col.label);
    const rows = cues.map(cue => columns.map(col => cue[col.key]));

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'cues.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-end">
        <button
          onClick={downloadCSV}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort(column.key)}
                >
                  <div className="flex items-center">
                    {column.label}
                    {sortConfig?.key === column.key && (
                      <span className="ml-1">
                        {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCues.map((cue, rowIndex) => (
              <tr
                key={cue.id}
                className={`hover:bg-yellow-50 ${editingCell?.cueId === cue.id ? 'bg-yellow-100' : ''}`}
                onClick={() => handleCellClick(cue, columns[editingCell?.colIndex || 0].key, rowIndex, editingCell?.colIndex || 0)}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={`${cue.id}-${column.key}`}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCellClick(cue, column.key, rowIndex, colIndex);
                    }}
                  >
                    {editingCell?.cueId === cue.id && editingCell?.field === column.key ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditSubmit}
                        onKeyDown={handleKeyDown}
                        className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className="min-h-[24px]">
                        {renderCell(cue, column.key, rowIndex, colIndex)}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CueSpreadsheet; 