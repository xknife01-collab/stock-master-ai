import React from 'react';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FloatingAlerts = ({ alerts }) => {
  return (
    <aside className="fixed bottom-12 right-8 flex flex-col gap-4 z-[100]">
      <AnimatePresence>
        {alerts.map(alert => (
          <motion.div 
            key={alert.id} 
            initial={{opacity:0, y:50, scale:0.8}} 
            animate={{opacity:1, y:0, scale:1}} 
            exit={{opacity:0, scale:0.5}} 
            className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 border backdrop-blur-xl ${alert.severity === 'urgent' ? 'bg-[#ff3d68] border-[#ff3d68]/50 text-white' : 'bg-[#7000ff] border-[#7000ff]/50 text-white'}`}
          >
            <div className="p-2 bg-white/20 rounded-xl"><Bell size={20} /></div>
            <p className="font-bold pr-8 text-sm">{alert.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
};

export default FloatingAlerts;
