// src/components/Navbar.tsx
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package, ShoppingCart, FileText, BarChart3, LogOut,
  Menu, X, User, Activity, Sparkles, DollarSign, Truck,
  Bot,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { signOut, profile, user } = useAuth();
  const { toast } = useToast();

  const role = profile?.role;
  const isShopAdmin = role === 'shop_admin';
  const isStaff = role === 'staff';
  const isCustomer = role === 'customer';

  // ── ADMIN NAVIGATION (Merged AI & Procurement) ─────────────
  const adminNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/freshness-monitor', label: 'Freshness AI', icon: Activity, color: 'text-green-600' },
    { path: '/sales', label: 'Sales', icon: ShoppingCart },
    { path: '/expense', label: 'Expenses', icon: DollarSign },
    
    { path: '/reports', label: 'Reports', icon: FileText },
    {
      path:'/ai-advisor',
  label: 'AI Advisor',
  icon: Bot,
}
  ];

  // ── STAFF NAVIGATION ───────────────────────────────────────
  const staffNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/freshness-monitor', label: 'Freshness AI', icon: Activity, color: 'text-green-600' },
    { path: '/sales', label: 'Sales', icon: ShoppingCart },
  ];

  // ── CUSTOMER NAVIGATION (Upgraded AI Assistant) ────────────
  const customerNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/ai-assistant', label: 'AI Assistant', icon: Sparkles, color: 'text-violet-600' },
    { path: '/sales', label: 'My Orders', icon: ShoppingCart },
  ];

  const navItems = isShopAdmin ? adminNavItems : isStaff ? staffNavItems : customerNavItems;
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: 'Success', description: 'Logged out successfully' });
      navigate('/');
    } catch (error) {
      toast({ title: 'Error', description: 'Logout failed', variant: 'destructive' });
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* LOGO: SmartMart Branding */}
          <div onClick={() => navigate('/dashboard')} className="flex items-center gap-3 cursor-pointer">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900 tracking-tight">SmartMart</h1>
              <p className="text-[10px] text-gray-500 font-bold uppercase leading-none">
                AI Retail Ecosystem
              </p>
            </div>
          </div>

          {/* DESKTOP NAV: With Dynamic AI Styling */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'default' : 'ghost'}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3 transition-colors ${
                  isActive(item.path) ? '' : item.color || ''
                }`}
                size="sm"
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
              </Button>
            ))}
          </div>

          {/* RIGHT SIDE: User Menu */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block mr-2">
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-gray-500">
                {role?.replace('_', ' ')}
              </Badge>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full border border-gray-100">
                  <User className="h-5 w-5 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-bold truncate">{profile?.name || 'My Account'}</p>
                  <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" /> Profile Settings
                </DropdownMenuItem>
                {isCustomer && (
                  <DropdownMenuItem onClick={() => navigate('/ai-assistant')} className="text-violet-600">
                    <Sparkles className="mr-2 h-4 w-4" /> AI Assistant
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* MOBILE MENU TOGGLE */}
            <div className="lg:hidden ml-2">
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* MOBILE NAVIGATION */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 py-4 space-y-1">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'default' : 'ghost'}
                onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                className={`w-full justify-start h-12 ${isActive(item.path) ? '' : item.color || ''}`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};
export default Navbar;