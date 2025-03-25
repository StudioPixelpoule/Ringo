import { supabase } from './supabase';

export interface ReportType {
  id: string;
  name: string;
  description: string;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchReportTypes(): Promise<ReportType[]> {
  try {
    console.log('📝 Fetching report types...');
    
    const { data, error } = await supabase
      .from('report_types')
      .select('*')
      .order('order');

    if (error) {
      console.error('❌ Error fetching report types:', error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} types`);
    return data || [];
  } catch (error) {
    console.error('❌ Failed to fetch report types:', error);
    throw new Error('Failed to fetch report types');
  }
}

export async function createReportType(type: Omit<ReportType, 'id' | 'created_at' | 'updated_at'>): Promise<ReportType> {
  try {
    console.log('📝 Creating report type:', type.name);
    
    const { data, error } = await supabase
      .from('report_types')
      .insert([type])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating report type:', error);
      throw error;
    }

    console.log('✅ Type created:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Failed to create report type:', error);
    throw new Error('Failed to create report type');
  }
}

export async function updateReportType(id: string, updates: Partial<ReportType>): Promise<ReportType> {
  try {
    console.log('📝 Updating report type:', id);
    
    const { data, error } = await supabase
      .from('report_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating report type:', error);
      throw error;
    }

    console.log('✅ Type updated:', id);
    return data;
  } catch (error) {
    console.error('❌ Failed to update report type:', error);
    throw new Error('Failed to update report type');
  }
}

export async function deleteReportType(id: string): Promise<void> {
  try {
    console.log('🗑️ Deleting report type:', id);

    // First check if type is in use
    const { count, error: countError } = await supabase
      .from('report_templates')
      .select('id', { count: 'exact', head: true })
      .eq('type_id', id);

    if (countError) throw countError;

    if (count && count > 0) {
      throw new Error('Ce type est utilisé par des modèles existants');
    }

    const { error } = await supabase
      .from('report_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('✅ Type deleted:', id);
  } catch (error) {
    console.error('❌ Failed to delete report type:', error);
    throw error instanceof Error ? error : new Error('Failed to delete report type');
  }
}

export async function reorderReportTypes(types: ReportType[]): Promise<void> {
  try {
    console.log('📝 Reordering report types...');
    
    const updates = types.map((type, index) => ({
      id: type.id,
      order: index + 1
    }));

    const { error } = await supabase
      .from('report_types')
      .upsert(updates);

    if (error) throw error;

    console.log('✅ Types reordered');
  } catch (error) {
    console.error('❌ Failed to reorder report types:', error);
    throw new Error('Failed to reorder report types');
  }
}