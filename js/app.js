var app = angular.module('hmmmApp', ['ngRoute', 'ngAnimate', 'ui.utils']);

app.run(function($rootScope, $location) {
  
  $rootScope.go = function(path, animationClass) {
    $rootScope.animationClass = animationClass;
    $location.path(path);
  }
  
  $rootScope.$on('$routeChangeSuccess', function() {
    // ga('send', 'pageview', $location.path());
  });
  
});

app.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'templates/editor.html',
      controller: 'EditorCtrl'
    })
    .when('/simulate', {
      templateUrl: 'templates/simulator.html',
      controller: 'SimulatorCtrl'
    })
    .when('/about', {
      templateUrl: 'templates/about.html'
    })
    .otherwise({
      redirectTo: '/'
    });
});

app.factory('HmmmSim', function() {
  
  var _showInstructions = true;
  var _hmmmCode = undefined;
  var _binary = undefined;
  
  return {
    getShowInstructions: function() {
      return _showInstructions;
    },
    setShowInstructions: function(showInstructions) {
      _showInstructions = showInstructions;
      return _showInstructions;
    },
    getHmmmCode: function() {
      return _hmmmCode;
    },
    setHmmmCode: function(hmmmCode) {
      _hmmmCode = hmmmCode;
      return _hmmmCode;
    },
    getBinary: function() {
      return _binary;
    },
    setBinary: function(binary) {
      _binary = binary;
      return _binary;
    }
  }
  
});

app.filter('binary', function() {
  
  return function(input) {
    return hmmm.util.spaceIntoNibbles(hmmm.util.binaryForInteger(input, 16));
  };
});

app.filter('instruction', ['HmmmSim', function(HmmmSim) {
  return function(input) {
    return hmmm.util.instructionFromBinary(input);
  }
}]);

app.controller('EditorCtrl', ['$scope', 'HmmmSim', function($scope, HmmmSim) {
  
  var hmmmEditor = ace.edit("hmmm-editor");
  hmmmEditor.getSession().setMode("ace/mode/hmmm");
  hmmmEditor.setTheme("ace/theme/monokai");
  hmmmEditor.setHighlightActiveLine(false);
  hmmmEditor.setShowPrintMargin(false);
  hmmmEditor.setValue(HmmmSim.getHmmmCode());

  var binEditor = ace.edit("bin-editor");
  binEditor.setTheme("ace/theme/monokai");
  binEditor.setReadOnly(true);
  binEditor.setHighlightActiveLine(false);
  binEditor.setShowPrintMargin(false);
  binEditor.setValue(HmmmSim.getBinary());
  
  var assembler = hmmm.assembler;
  
  var Range = ace.require("ace/range").Range;
  
  var errorMarkerIds = [];
  
  $scope.showInstructions = HmmmSim.getShowInstructions();
  
  if (HmmmSim.getBinary()) {
    $scope.enableSimulation = true;
  }
  else {
    $scope.enableSimulation = false;
  }
  
  
  $scope.assemble = function() {

    var session = hmmmEditor.session;
    session.clearAnnotations();
    errorMarkerIds.forEach(function(markerId) {
      session.removeMarker(markerId);
    });
    errorMarkerIds = [];
    
    var output = assembler.assemble(hmmmEditor.getValue());
    if (output.errors !== undefined) {
      
      $scope.enableSimulation = false;
      
      session.setAnnotations(output.errors.map(function(e){
        var markerRange = new Range(e.range.start.row - 1, e.range.start.column - 1, e.range.end.row - 1, e.range.end.column - 1);
        var markerId = session.addMarker(markerRange, "hmmm-error", "text");
        errorMarkerIds.push(markerId);
        return {
          row: e.range.start.row - 1,
          column: e.range.start.column,
          text: e.message,
          type: "error"
        }
      }));
      
      HmmmSim.setHmmmCode(undefined);
      HmmmSim.setBinary(undefined);
      
      binEditor.setValue("");
    }
    else {
      binEditor.setValue(output.binary);
      HmmmSim.setHmmmCode(hmmmEditor.getValue());
      HmmmSim.setBinary(output.binary);
      $scope.enableSimulation = true;
    }
  }
  
  $scope.dismissInstructions = function() {
    $scope.showInstructions = false;
    HmmmSim.setShowInstructions(false);
  }
  
  $scope.saveFile = function() {
    if (hmmmEditor.getValue() === '') {
      return;
    }
    var blob = new Blob([hmmmEditor.getValue()], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "source.hmmm");
  }
  
  $scope.loadFile = function() {
    $('#secret-file-select').click();
  }
  
  $scope.fileSelected = function(input) {
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      hmmmEditor.setValue(text);
    };
    reader.readAsText(file);
  }
  
}]);

app.controller('SimulatorCtrl', ['$scope', '$location', '$timeout', 'HmmmSim', function($scope, $location, $timeout, HmmmSim) {
  var hmmmConsole = ace.edit("hmmm-console");
  hmmmConsole.setTheme("ace/theme/monokai");
  hmmmConsole.setReadOnly(true);
  hmmmConsole.setShowPrintMargin(false);
  hmmmConsole.renderer.setShowGutter(false);
  
  $scope.timingDelay = 100;
  
  // Allow fluid layout for affixed sidebar elements
  $('[data-clampedwidth]').each(function () {
    var elem = $(this);
    var parentPanel = elem.data('clampedwidth');
    var resizeFn = function () {
        var sideBarNavWidth = $(parentPanel).width() - parseInt(elem.css('paddingLeft')) - parseInt(elem.css('paddingRight')) - parseInt(elem.css('marginLeft')) - parseInt(elem.css('marginRight')) - parseInt(elem.css('borderLeftWidth')) - parseInt(elem.css('borderRightWidth'));
        elem.css('width', sideBarNavWidth);
    };

    resizeFn();
    $(window).resize(resizeFn);
  });
  
  var inHandler = function() {
    return +(prompt("Please input an integer"));
  }
  
  var outAndErrHandler = function(data) {
    hmmmConsole.navigateFileEnd();
    hmmmConsole.insert(data + "\n");
  }
  
  var simulator = hmmm.simulator.createSimulator(inHandler, outAndErrHandler, outAndErrHandler);
  $scope.simulator = simulator;

  var binary = HmmmSim.getBinary();
  if (!binary) {
    // $location.path("/")
  }
  else {
    simulator.loadBinary(HmmmSim.getBinary());
  }
  
  $scope.currentTimeout = undefined;
  
  $scope.runProgram = function() {
    var execute = function() {
      if (simulator.state !== hmmm.simulator.simulatorStates.ERROR && simulator.state !== hmmm.simulator.simulatorStates.HALT) {
        $scope.currentTimeout = $timeout(execute, $scope.timingDelay);
        simulator.runNextInstruction();
      }
      else {
        $scope.currentTimeout = undefined;
      }
    }
    execute();
  }
  
  $scope.pauseExecution = function() {
    if ($scope.currentTimeout) {
      $timeout.cancel($scope.currentTimeout);
      $scope.currentTimeout = undefined;
    }
  }
  
  $scope.reset = function() {
    simulator.resetMachine();
    hmmmConsole.setValue("");
  }
  
  $scope.stepForward = function() {
    simulator.runNextInstruction();
  }
  
  $scope.stepBack = function() {
    simulator.stepBackward();
  }
  
}]);