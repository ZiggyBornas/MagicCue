import React, { useState } from 'react';
import { Cue } from '../types/project';

interface CueManagerProps {
  cues: Cue[];
  selectedCue: Cue | null;
  onCueAdd: (cue: Omit<Cue, 'id'>) => void;
  onCueUpdate: (cue: Cue) => void;
  onCueDelete: (cueId: string) => void;
}

const CueManager: React.FC<CueManagerProps> = ({
  cues,
  selectedCue,
  onCueAdd,
  onCueUpdate,
  onCueDelete,
}) => {
  const [newCue, setNewCue] = useState<Omit<Cue, 'id'>>({
    number: cues.length + 1,
    page: 1,
    position: { x: 0, y: 0 },
    label: `Cue ${cues.length + 1}`,
    time: '',
    notes: '',
    color: 'blue',
    type: 'LX'
  });

  const handleAddCue = () => {
    onCueAdd(newCue);
    setNewCue({
      number: cues.length + 2,
      page: 1,
      position: { x: 0, y: 0 },
      label: `Cue ${cues.length + 2}`,
      time: '',
      notes: '',
      color: 'blue',
      type: 'LX'
    });
  };

  const handleUpdateCue = (cue: Cue) => {
    onCueUpdate(cue);
  };

  const handleDeleteCue = (cueId: string) => {
    onCueDelete(cueId);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Add New Cue</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={newCue.type}
              onChange={(e) => setNewCue({ ...newCue, type: e.target.value as Cue['type'] })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="LX">Lighting (LX)</option>
              <option value="SFX">Sound Effects (SFX)</option>
              <option value="VIDEO">Video</option>
              <option value="PROPS">Props</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Label</label>
            <input
              type="text"
              value={newCue.label}
              onChange={(e) => setNewCue({ ...newCue, label: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Time</label>
            <input
              type="text"
              value={newCue.time}
              onChange={(e) => setNewCue({ ...newCue, time: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={newCue.notes}
              onChange={(e) => setNewCue({ ...newCue, notes: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <select
              value={newCue.color}
              onChange={(e) => setNewCue({ ...newCue, color: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="blue">Blue</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="yellow">Yellow</option>
              <option value="purple">Purple</option>
              <option value="orange">Orange</option>
              <option value="pink">Pink</option>
              <option value="gray">Gray</option>
            </select>
          </div>
          <button
            onClick={handleAddCue}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Cue
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Existing Cues</h3>
        <div className="space-y-4">
          {cues.map((cue) => (
            <div key={cue.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-medium">{cue.type} - {cue.label}</span>
                  <span className="text-gray-500 ml-2">(Cue {cue.number})</span>
                </div>
                <button
                  onClick={() => handleDeleteCue(cue.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
              <div className="text-sm text-gray-600">
                <div>Time: {cue.time || 'Not set'}</div>
                <div>Notes: {cue.notes || 'None'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CueManager; 