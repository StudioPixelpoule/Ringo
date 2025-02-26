export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  user_id: string;
  folder: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}