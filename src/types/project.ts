export interface Project {
  id: string;
  name: string;
  icon: string;
  pdfUrl: string;
  cues: Cue[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface Cue {
  id: string;
  number: number;
  page: number;
  position: {
    x: number;
    y: number;
  };
  label: string;
  time: string;
  notes: string;
  color: string;
  type: 'LX' | 'SFX' | 'VIDEO' | 'PROPS' | 'OTHER';
  lineLength?: number;
  rotation?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  projects: Project[];
} 