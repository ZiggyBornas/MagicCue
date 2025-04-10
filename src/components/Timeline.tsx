import React from 'react';
import { Cue } from '../types/project';

interface TimelineProps {
  cues: Cue[];
  onCueClick: (cue: Cue) => void;
}

const Timeline: React.FC<TimelineProps> = ({ cues, onCueClick }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Timeline</h2>
      <div className="space-y-4">
        {cues.map((cue) => (
          <div
            key={cue.id}
            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onCueClick(cue)}
          >
            <div
              className="w-4 h-4 rounded-full mr-3"
              style={{ backgroundColor: cue.color }}
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-900">
                  {cue.label}
                </span>
                {cue.time && (
                  <span className="text-gray-600 text-sm">- {cue.time}</span>
                )}
              </div>
              {cue.notes && (
                <p className="text-gray-600 text-sm mt-1">{cue.notes}</p>
              )}
            </div>
          </div>
        ))}
        {cues.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No cues added yet</p>
            <p className="text-sm">Click on the PDF to add cues</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Timeline; 