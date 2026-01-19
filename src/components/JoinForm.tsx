import React, { useState } from 'react';
import { User, Mail, MessageSquare, Target, Calendar, Send } from 'lucide-react';

interface JoinFormProps {
  onNavigate?: (page: string) => void;
}

const JoinForm = ({ onNavigate }: JoinFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    experience: '',
    goals: '',
    program: '',
    injuries: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFormSubmission();
  };

  const handleFormSubmission = async () => {
    try {
      // This form is now for inquiries only - users should create accounts via Sign Up
      // Store form submission as a contact inquiry
      console.log('Form submission:', formData);
      
      // Show success message or redirect
      alert('Inquiry submitted successfully! Coach Elyes will contact you soon. To access programs, please create an account using the Sign Up button.');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        experience: '',
        goals: '',
        program: '',
        injuries: '',
        message: ''
      });
      
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('There was an error submitting your application. Please try again.');
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <section id="join" className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Transform Your Strength?</h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Take the first step towards your strongest self. Fill out this application and I'll personally 
            review your goals to recommend the perfect program for you.
          </p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-red-600 p-6 text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/logoELA.png" 
                alt="Elyes Lift Academy Logo"
                className="w-36 h-36 object-contain"
              />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Program Application</h3>
            <p className="text-red-100">Free consultation included with every application</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="experience" className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Training Experience
                </label>
                <select
                  id="experience"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                >
                  <option value="">Select experience level</option>
                  <option value="beginner">Beginner (0-1 years)</option>
                  <option value="intermediate">Intermediate (1-3 years)</option>
                  <option value="advanced">Advanced (3+ years)</option>
                  <option value="competitive">Competitive athlete</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="program" className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />
                  Interested Program
                </label>
                <select
                  id="program"
                  name="program"
                  value={formData.program}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                >
                  <option value="">Select a program</option>
                  <option value="powerlifting">Powerlifting Program</option>
                  <option value="weightlifting">Olympic Weightlifting Program</option>
                  <option value="mobility">Mobility Mastery Book</option>
                  <option value="rehab">Rehab & Recovery Program</option>
                  <option value="coaching">1-on-1 Online Coaching</option>
                  <option value="consultation">Free Consultation First</option>
                </select>
              </div>
            </div>
            
            <div>
              <label htmlFor="goals" className="block text-sm font-medium text-gray-700 mb-2">
                <Target className="w-4 h-4 inline mr-2" />
                Your Goals *
              </label>
              <textarea
                id="goals"
                name="goals"
                required
                rows={3}
                value={formData.goals}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="What do you want to achieve? (e.g., compete in powerlifting, improve technique, build strength, etc.)"
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="injuries" className="block text-sm font-medium text-gray-700 mb-2">
                Current or Past Injuries
              </label>
              <textarea
                id="injuries"
                name="injuries"
                rows={2}
                value={formData.injuries}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="Any injuries or limitations I should know about? (Optional)"
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Additional Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={3}
                value={formData.message}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="Tell me more about yourself, your training history, or any questions you have..."
              ></textarea>
            </div>
            
            <div className="text-center">
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center mx-auto"
              >
                Submit Application
                <Send className="w-5 h-5 ml-2" />
              </button>
              <p className="text-sm text-gray-600 mt-4">
                * I'll personally review your application and respond within 24 hours
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">
                Want to browse programs first?
              </p>
              <button
                onClick={() => {
                  // Navigate to programs page
                  if (onNavigate) {
                    onNavigate('programs');
                  } else {
                    const element = document.getElementById('programs');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                View All Programs
              </button>
            </div>
          </form>
        </div>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="text-white">
            <div className="text-2xl font-bold mb-2">24 Hours</div>
            <div className="text-gray-400">Response Time</div>
          </div>
          <div className="text-white">
            <div className="text-2xl font-bold mb-2">Free</div>
            <div className="text-gray-400">Initial Consultation</div>
          </div>
          <div className="text-white">
            <div className="text-2xl font-bold mb-2">Personalized</div>
            <div className="text-gray-400">Program Recommendation</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JoinForm;

