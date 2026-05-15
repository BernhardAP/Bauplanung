import {
  Activity, AlertCircle, AlertTriangle, Archive, ArrowRight, Award, Ban,
  Bell, Bookmark, Box, Calendar, Check, CheckCircle2, Circle, CircleDashed,
  CircleDot, Clock, Cloud, Coffee, Cpu, Eye, EyeOff, Flag, Flame, Folder,
  Gift, HandMetal, Heart, HelpCircle, Hourglass, Inbox, Info, Key, Layers,
  Lightbulb, Link, ListChecks, Loader2, Lock, Mail, MessageCircle, Minus,
  Moon, MoreHorizontal, Package, Pause, Phone, Pin, Play, Plus, Power,
  RefreshCw, Rocket, Save, Search, Send, Settings, Shield, ShoppingCart,
  Sparkles, Star, Sun, Tag, Target, ThumbsDown, ThumbsUp, Timer, Trash2,
  Trophy, Truck, Unlock, User, Users, Wrench, X, XCircle, Zap,
  type LucideIcon,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Activity, AlertCircle, AlertTriangle, Archive, ArrowRight, Award, Ban,
  Bell, Bookmark, Box, Calendar, Check, CheckCircle2, Circle, CircleDashed,
  CircleDot, Clock, Cloud, Coffee, Cpu, Eye, EyeOff, Flag, Flame, Folder,
  Gift, HandMetal, Heart, HelpCircle, Hourglass, Inbox, Info, Key, Layers,
  Lightbulb, Link, ListChecks, Loader2, Lock, Mail, MessageCircle, Minus,
  Moon, MoreHorizontal, Package, Pause, Phone, Pin, Play, Plus, Power,
  RefreshCw, Rocket, Save, Search, Send, Settings, Shield, ShoppingCart,
  Sparkles, Star, Sun, Tag, Target, ThumbsDown, ThumbsUp, Timer, Trash2,
  Trophy, Truck, Unlock, User, Users, Wrench, X, XCircle, Zap,
};

export const ICON_NAMES = Object.keys(ICON_MAP).sort();

export function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Circle;
  return ICON_MAP[name] ?? Circle;
}
