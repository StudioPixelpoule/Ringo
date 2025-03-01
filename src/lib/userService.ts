import { supabase } from './supabase';
import { logger } from './logger';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'user' | 'reader';
  status: 'active' | 'inactive';
  created_at: string;
  last_login?: string;
  last_activity?: string;
  email_confirmed?: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  ip_address?: string;
  user_agent?: string;
  login_at: string;
  logout_at?: string;
}

export interface UserCreateParams {
  email: string;
  first_name?: string;
  last_name?: string;
  role?: 'admin' | 'user' | 'reader';
}

export interface UserUpdateParams {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'admin' | 'user' | 'reader';
}

/**
 * Service pour gérer les utilisateurs
 */
class UserService {
  /**
   * Récupérer tous les utilisateurs
   */
  async getAllUsers(): Promise<User[]> {
    try {
      // Récupérer les profils
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) {
        throw profilesError;
      }

      // Récupérer les emails des utilisateurs en utilisant la fonction sécurisée
      const { data: authUsers, error: authError } = await supabase
        .rpc('get_auth_users');

      if (authError) {
        console.warn('Impossible de récupérer les emails des utilisateurs:', authError);
        logger.warning('Impossible de récupérer les emails des utilisateurs', { error: authError }, 'UserService');
      }

      // Combiner les données
      return (profiles || []).map(profile => {
        const authUser = authUsers?.find(user => user.id === profile.id);
        return {
          id: profile.id,
          email: authUser?.email || 'Email non disponible',
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          role: profile.role,
          status: profile.status || 'active',
          created_at: authUser?.created_at || profile.created_at,
          last_login: profile.last_login,
          last_activity: profile.last_activity,
          email_confirmed: authUser?.email_confirmed_at ? true : false
        };
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des utilisateurs', error, 'UserService');
      throw error;
    }
  }

  /**
   * Récupérer un utilisateur par son ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile) {
        return null;
      }

      // Récupérer l'email de l'utilisateur en utilisant la fonction sécurisée
      const { data: authUser, error: authError } = await supabase
        .rpc('get_auth_user_by_id', { user_id: userId });

      if (authError) {
        console.warn('Impossible de récupérer l\'email de l\'utilisateur:', authError);
        logger.warning('Impossible de récupérer l\'email de l\'utilisateur', { userId, error: authError }, 'UserService');
      }

      return {
        id: profile.id,
        email: authUser?.email || 'Email non disponible',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        role: profile.role,
        status: profile.status || 'active',
        created_at: authUser?.created_at || profile.created_at,
        last_login: profile.last_login,
        last_activity: profile.last_activity,
        email_confirmed: authUser?.email_confirmed_at ? true : false
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'utilisateur', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Vérifier si un utilisateur existe
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      // Vérifier d'abord si l'utilisateur existe dans la table profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      if (!profileError && profile) {
        return true;
      }
      
      // Si la vérification dans profiles échoue, essayer avec la fonction RPC
      try {
        const { data, error } = await supabase
          .rpc('user_exists', { p_user_id: userId });

        if (error) {
          throw error;
        }

        return !!data;
      } catch (rpcError) {
        // Si la fonction RPC échoue, faire une vérification directe
        console.warn('Erreur lors de l\'appel à user_exists, tentative de vérification directe:', rpcError);
        
        const { data: authUser, error: authError } = await supabase
          .rpc('get_auth_user_by_id', { user_id: userId });
        
        if (authError) {
          throw authError;
        }
        
        return !!authUser;
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification de l\'existence de l\'utilisateur', { userId, error }, 'UserService');
      return false;
    }
  }

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(params: UserCreateParams): Promise<{ user_id: string; email: string; temp_password: string }> {
    try {
      const { email, first_name = '', last_name = '', role = 'user' } = params;

      // Vérifier si l'email est déjà utilisé
      const { data: emailExists, error: checkError } = await supabase
        .rpc('check_email_exists', { p_email: email });

      if (checkError) {
        throw checkError;
      }

      if (emailExists) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      // Créer l'utilisateur via la fonction RPC
      const { data, error } = await supabase.rpc('admin_create_user', {
        p_email: email,
        p_first_name: first_name,
        p_last_name: last_name,
        p_role: role
      });

      if (error) {
        throw error;
      }

      logger.info('Nouvel utilisateur créé', { email, role }, 'UserService');

      return data;
    } catch (error) {
      logger.error('Erreur lors de la création de l\'utilisateur', { ...params, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(params: UserUpdateParams): Promise<boolean> {
    try {
      const { id, email, first_name, last_name, role } = params;

      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(id);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${id} n'existe pas`);
      }

      // Mettre à jour l'utilisateur via la fonction RPC
      const { data, error } = await supabase.rpc('admin_update_user', {
        p_user_id: id,
        p_email: email,
        p_first_name: first_name,
        p_last_name: last_name,
        p_role: role
      });

      if (error) {
        throw error;
      }

      logger.info('Utilisateur mis à jour', { userId: id }, 'UserService');

      return true;
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'utilisateur', { ...params, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Désactiver un utilisateur
   */
  async disableUser(userId: string): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${userId} n'existe pas`);
      }

      const { data, error } = await supabase.rpc('admin_disable_user', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      logger.info('Utilisateur désactivé', { userId }, 'UserService');

      return true;
    } catch (error) {
      logger.error('Erreur lors de la désactivation de l\'utilisateur', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Réactiver un utilisateur
   */
  async enableUser(userId: string): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${userId} n'existe pas`);
      }

      const { data, error } = await supabase.rpc('admin_enable_user', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      logger.info('Utilisateur réactivé', { userId }, 'UserService');

      return true;
    } catch (error) {
      logger.error('Erreur lors de la réactivation de l\'utilisateur', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${userId} n'existe pas`);
      }

      const { data, error } = await supabase.rpc('admin_delete_user', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      logger.info('Utilisateur supprimé', { userId }, 'UserService');

      return true;
    } catch (error) {
      logger.error('Erreur lors de la suppression de l\'utilisateur', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Réinitialiser le mot de passe d'un utilisateur
   */
  async resetUserPassword(userId: string): Promise<string> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${userId} n'existe pas`);
      }

      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      logger.info('Mot de passe utilisateur réinitialisé', { userId }, 'UserService');

      return data;
    } catch (error) {
      logger.error('Erreur lors de la réinitialisation du mot de passe', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Forcer la déconnexion d'un utilisateur
   */
  async forceLogout(userId: string): Promise<boolean> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${userId} n'existe pas`);
      }

      const { data, error } = await supabase.rpc('admin_force_logout', {
        p_user_id: userId
      });

      if (error) {
        throw error;
      }

      logger.info('Déconnexion forcée de l\'utilisateur', { userId }, 'UserService');

      return true;
    } catch (error) {
      logger.error('Erreur lors de la déconnexion forcée', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Récupérer les sessions d'un utilisateur
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        throw new Error(`L'utilisateur avec l'ID ${userId} n'existe pas`);
      }

      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('login_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Erreur lors de la récupération des sessions', { userId, error }, 'UserService');
      throw error;
    }
  }

  /**
   * Enregistrer une nouvelle session utilisateur
   */
  async recordUserSession(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        logger.warning(`Tentative d'enregistrement de session pour un utilisateur inexistant`, { userId }, 'UserService');
        return;
      }

      const { error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Erreur lors de l\'enregistrement de la session', { userId, error }, 'UserService');
      // Ne pas propager l'erreur pour ne pas bloquer l'authentification
    }
  }

  /**
   * Mettre à jour la dernière activité d'un utilisateur
   */
  async updateUserActivity(userId: string): Promise<void> {
    try {
      // Vérifier si l'utilisateur existe
      const exists = await this.userExists(userId);
      if (!exists) {
        logger.warning(`Tentative de mise à jour de l'activité pour un utilisateur inexistant`, { userId }, 'UserService');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de l\'activité', { userId, error }, 'UserService');
      // Ne pas propager l'erreur pour ne pas bloquer l'application
    }
  }
}

export const userService = new UserService();