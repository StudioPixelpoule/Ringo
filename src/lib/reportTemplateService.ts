import { supabase } from './supabase';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'summary' | 'analysis' | 'comparison' | 'extraction';
  prompt: string;
  structure?: string | {
    sections: Array<{
      title: string;
      required: boolean;
    }>;
  };
  is_active: boolean;
  folder_id?: string | null;
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

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch report templates:', error);
    return [];
  }
}

export async function createReportTemplate(template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ReportTemplate | null> {
  try {
    // Check if template with same name exists
    const { data: existing } = await supabase
      .from('report_templates')
      .select('id')
      .eq('name', template.name)
      .single();

    if (existing) {
      throw new Error('Un modèle avec ce nom existe déjà');
    }

    // If structure is a string, parse it into the required format
    const structureObject = typeof template.structure === 'string'
      ? {
          sections: template.structure.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => ({
              title: line.endsWith('*') ? line.slice(0, -1).trim() : line,
              required: line.endsWith('*')
            }))
        }
      : template.structure;

    const { data, error } = await supabase
      .from('report_templates')
      .insert([{ ...template, structure: structureObject }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to create report template:', error);
    throw error;
  }
}

export async function updateReportTemplate(id: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
  try {
    // If structure is being updated and is a string, parse it
    const updatesWithParsedStructure = {
      ...updates,
      structure: typeof updates.structure === 'string'
        ? {
            sections: updates.structure.split('\n')
              .map(line => line.trim())
              .filter(line => line)
              .map(line => ({
                title: line.endsWith('*') ? line.slice(0, -1).trim() : line,
                required: line.endsWith('*')
              }))
          }
        : updates.structure
    };

    const { data, error } = await supabase
      .from('report_templates')
      .update(updatesWithParsedStructure)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
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

    if (error) throw error;
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

    if (error) throw error;
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

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch report template:', error);
    return null;
  }
}