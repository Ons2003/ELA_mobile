import React, { useState } from 'react';
import { Calculator, Target, TrendingUp, Award, Play, ArrowRight, BarChart3, Users, CheckCircle } from 'lucide-react';
import StrengthAssessment from './StrengthAssessment';

const StrengthAssessmentSection = () => {
  const [showAssessment, setShowAssessment] = useState(false);

  if (showAssessment) {
    return (
      <section id="strength-assessment" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StrengthAssessment />
        </div>
      </section>
    );
  }

  return (
    <section id="strength-assessment" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Calculator className="w-4 h-4 mr-2" />
            Free Assessment Tool
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Discover Your Strength Level</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Take our comprehensive strength assessment to get personalized program recommendations 
            based on your current abilities, goals, and experience level.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Assessment Preview */}
          <div>
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">What You'll Get</h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="bg-red-100 p-2 rounded-lg mr-4 flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Strength Level Analysis</h4>
                    <p className="text-gray-600 text-sm">Compare your lifts to strength standards and see where you rank</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-blue-100 p-2 rounded-lg mr-4 flex-shrink-0">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Personalized Recommendations</h4>
                    <p className="text-gray-600 text-sm">Get matched with programs that fit your current level and goals</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-green-100 p-2 rounded-lg mr-4 flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Progress Tracking</h4>
                    <p className="text-gray-600 text-sm">Understand your strengths and areas for improvement</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-purple-100 p-2 rounded-lg mr-4 flex-shrink-0">
                    <Award className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Expert Guidance</h4>
                    <p className="text-gray-600 text-sm">Recommendations based on proven coaching methods</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowAssessment(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-semibold transition-colors flex items-center justify-center"
              >
                <Calculator className="w-5 h-5 mr-2" />
                Start Free Assessment
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>

          {/* Visual Preview */}
          <div>
            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">Assessment Process</h3>
              
              <div className="space-y-6">
                <div className="flex items-center">
                  <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-sm font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Personal Information</h4>
                    <p className="text-red-100 text-sm">Age, gender, bodyweight, and experience level</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-sm font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Current Lifts</h4>
                    <p className="text-red-100 text-sm">Your best squat, bench press, and deadlift</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-sm font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Training Goals</h4>
                    <p className="text-red-100 text-sm">What you want to achieve with your training</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center mr-4 flex-shrink-0">
                    <span className="text-sm font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Get Results</h4>
                    <p className="text-red-100 text-sm">Personalized program recommendations</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-100">Takes only 3-5 minutes</span>
                  <span className="text-red-100">100% Free</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">1,200+</div>
            <div className="text-gray-600">Assessments Completed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">95%</div>
            <div className="text-gray-600">Accuracy Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">3-5</div>
            <div className="text-gray-600">Minutes to Complete</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">Free</div>
            <div className="text-gray-600">No Cost, No Signup</div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <div className="flex items-center mb-6">
            <img 
              src="/IMG_8970.jpg" 
              alt="User testimonial"
              className="w-12 h-12 rounded-full object-cover mr-4"
            />
            <div>
              <h4 className="font-semibold text-gray-900">Ahmed K.</h4>
              <p className="text-gray-600 text-sm">Powerlifter from Tunis</p>
            </div>
          </div>
          <blockquote className="text-lg text-gray-700 italic mb-4">
            "The assessment perfectly matched me with the squat program. After following the recommendations, 
            I added 15kg to my squat in just 6 weeks. The analysis was spot-on!"
          </blockquote>
          <div className="flex items-center">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-4 h-4 text-yellow-400 fill-current">★</div>
              ))}
            </div>
            <span className="text-sm text-gray-600 ml-2">Verified result</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StrengthAssessmentSection;