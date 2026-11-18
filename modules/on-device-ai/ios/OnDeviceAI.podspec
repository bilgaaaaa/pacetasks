# Local Expo module, autolinked from modules/. FoundationModels exists from iOS 26,
# so it is weak-linked: the app still starts on iOS 17–25, where the model is reported unavailable.
Pod::Spec.new do |s|
  s.name           = 'OnDeviceAI'
  s.version        = '1.0.0'
  s.summary        = "Apple's on-device language model (Foundation Models) for Brain Dump"
  s.author         = 'PaceTasks'
  s.homepage       = 'https://github.com/bilgaaaaa/pacetasks'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '17.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
