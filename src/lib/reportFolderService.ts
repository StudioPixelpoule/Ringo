import { supabase } from './supabase';

export interface ReportFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchReportFolders(): Promise<ReportFolder[]> {
  try {
    const { data, error } = await supabase
      .from('report_folders')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch report folders:', error);
    return [];
  }
}

export async function createReportFolder(name: string, parentId: string | null): Promise<ReportFolder | null> {
  try {
    const { data, error } = await supabase
      .from('report_folders')
      .insert([{
        name,
        parent_id: parentId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create report folder:', error);
    return null;
  }
}

export async function updateReportFolder(id: string, name: string): Promise<ReportFolder | null> {
  try {
    const { data, error } = await supabase
      .from('report_folders')
      .update({ name })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to update report folder:', error);
    return null;
  }
}

export async function deleteReportFolder(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('report_folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to delete report folder:', error);
    return false;
  }
}