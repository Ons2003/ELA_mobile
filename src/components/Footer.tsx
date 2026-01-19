import React from 'react';
import { Instagram, Mail, MessageCircle, MapPin } from 'lucide-react';

const Footer = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
            
            </div>
          
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/elyes_zerai" className="text-gray-400 hover:text-red-600 transition-colors">
                <Instagram className="w-10 h-10" />
              </a>
              <a href="mailto:elyesaccademylift@gmail.com" className="text-gray-400 hover:text-red-600 transition-colors">
                <Mail className="w-10 h-10" />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <button onClick={() => scrollToSection('home')} className="text-gray-400 hover:text-white transition-colors">
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('about')} className="text-gray-400 hover:text-white transition-colors">
                  About Coach
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('programs')} className="text-gray-400 hover:text-white transition-colors">
                  Training Programs
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('testimonials')} className="text-gray-400 hover:text-white transition-colors">
                  Success Stories
                </button>
              </li>
              <li>
                <button onClick={() => scrollToSection('contact')} className="text-gray-400 hover:text-white transition-colors">
                  Contact
                </button>
              </li>
            </ul>
          </div>
          
          {/* Partners */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Partners</h4>
            <ul className="space-y-3">
              <li>
                <a href="https://www.impactnutrition.com.tn" className="text-gray-400 hover:text-white transition-colors">
                  Impact Sports Nutrition
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/cactus._.fit/?hl=en" className="text-gray-400 hover:text-white transition-colors">
                  CACTUS FIT
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/benyaghlaneshops_biwai" className="text-gray-400 hover:text-white transition-colors">
                  Ben Yaghlene Shops - BIWAI
                </a>
              </li>
            </ul>
          </div>
          
          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-start">
                <Mail className="w-4 h-4 text-red-600 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <a href="mailto:elyesaccademylift@gmail.com" className="text-white hover:text-red-600 transition-colors">
                    elyesaccademylift@gmail.com
                  </a>
                </div>
              </div>
              <div className="flex items-start">
                <MapPin className="w-4 h-4 text-red-600 mt-1 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-gray-400 text-sm">Location</p>
                  <p className="text-white">Tunis, Tunisia</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm">
              <p>&copy; 2025 Elyes Lift Academy. All rights reserved.</p>
            </div>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                Terms of Service
              </a>
              <div className="flex items-center text-sm text-gray-400">
                <span>Sponsored by</span>
                <a 
                  href="https://www.impactnutrition.com.tn/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-red-600 font-semibold hover:text-red-400 transition-colors"
                >
                  Impact Nutrition
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;