import { supabase } from './supabase';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'summary' | 'analysis' | 'comparison' | 'extraction';
  prompt: string;
  structure?: {
    sections: Array<{
      title: string;
      required: boolean;
    }>;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchReportTemplates(): Promise<ReportTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching report templates:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch report templates:', error);
    return [];
  }
}

export async function createReportTemplate(template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ReportTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('report_templates')
      .insert([template])
      .select()
      .single();

    if (error) {
      console.error('Error creating report template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to create report template:', error);
    return null;
  }
}

export async function updateReportTemplate(id: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('report_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating report template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update report template:', error);
    return null;
  }
}

export async function deleteReportTemplate(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting report template:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete report template:', error);
    return false;
  }
}

export async function toggleReportTemplateStatus(id: string, isActive: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('report_templates')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      console.error('Error toggling report template status:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to toggle report template status:', error);
    return false;
  }
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching report template:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch report template:', error);
    return null;
  }
}