Components
========

This folder contains all of your P5 "components". A component is a reusable piece of logic, written 
in Hyperlisp, which you can reuse across multiple apps. Think "COM, the Hyperlisp version".

There is one file which most components would declare, which is "startup.hl", expected to do
the initialization of your component. Usually, if this file exists, it will create the Active Events
necessary to consume your component.

This allows you to distribute your Phosphorus components using x-copy deployment.
By default, Phosphorus Five contains several pre-built components. If you wish to remove these,
simply delete the folder containing your component. Preferably _before_ you start your server 
the first time, such that the component's initialization logic does not run.
