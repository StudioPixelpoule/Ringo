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
    console.log('📝 Fetching report templates...');
    
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('❌ Error fetching report templates:', error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} templates`);
    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch report templates:', error);
    throw new Error('Failed to fetch report templates');
  }
}

export async function createReportTemplate(template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ReportTemplate> {
  try {
    console.log('📝 Creating report template:', template.name);
    
    const { data, error } = await supabase
      .from('report_templates')
      .insert([template])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating report template:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned after creating template');
    }

    console.log('✅ Template created:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Failed to create report template:', error);
    throw new Error('Failed to create report template');
  }
}

export async function updateReportTemplate(id: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate> {
  try {
    console.log('📝 Updating report template:', id);
    
    const { data, error } = await supabase
      .from('report_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating report template:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No data returned after updating template');
    }

    console.log('✅ Template updated:', id);
    return data;
  } catch (error) {
    console.error('❌ Failed to update report template:', error);
    throw new Error('Failed to update report template');
  }
}

export async function deleteReportTemplate(id: string): Promise<void> {
  try {
    console.log('🗑️ Deleting report template:', id);

    // First verify the template exists
    const { data: template, error: checkError } = await supabase
      .from('report_templates')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError) {
      console.error('❌ Error checking template existence:', checkError);
      throw checkError;
    }

    if (!template) {
      console.error('❌ Template not found:', id);
      throw new Error('Template not found');
    }

    // Then delete the template
    const { error: deleteError } = await supabase
      .from('report_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error deleting report template:', deleteError);
      throw deleteError;
    }

    console.log('✅ Template deleted:', id);
  } catch (error) {
    console.error('❌ Failed to delete report template:', error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to delete report template'
    );
  }
}

export async function toggleReportTemplateStatus(id: string, isActive: boolean): Promise<boolean> {
  try {
    console.log('📝 Toggling template status:', { id, isActive });
    
    const { error } = await supabase
      .from('report_templates')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      console.error('❌ Error toggling report template status:', error);
      throw error;
    }

    console.log('✅ Template status updated:', id);
    return true;
  } catch (error) {
    console.error('❌ Failed to toggle report template status:', error);
    throw new Error('Failed to toggle report template status');
  }
}

export async function getReportTemplate(id: string): Promise<ReportTemplate | null> {
  try {
    console.log('📝 Fetching report template:', id);
    
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching report template:', error);
      throw error;
    }

    console.log('✅ Template fetched:', id);
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch report template:', error);
    return null;
  }
}