/*
 * phosphorus five, copyright 2014 - Mother Earth, Jannah, Gaia
 * phosphorus five is licensed as mit, see the enclosed LICENSE file for details
 */

using System;
using System.Web.UI;

namespace phosphorus.ajax.widgets
{
    /// <summary>
    /// a widget that does not contain children widgets, but instead it contains only text as its inner content. use the 
    /// innerValue property to access the text content of the widget
    /// </summary>
    [ParseChildren(true, "innerValue")]
    [PersistChildren(false)]
    [ViewStateModeById]
    public class Literal : Widget
    {
        /// <summary>
        /// initializes a new instance of the <see cref="phosphorus.ajax.widgets.Literal"/> class
        /// </summary>
        public Literal ()
        { }

        /// <summary>
        /// initializes a new instance of the <see cref="phosphorus.ajax.widgets.Literal"/> class
        /// </summary>
        /// <param name="elementType">html element to render widget with</param>
        public Literal (string elementType)
            : base (elementType)
        { }

        /// <summary>
        /// initializes a new instance of the <see cref="phosphorus.ajax.widgets.Literal"/> class
        /// </summary>
        /// <param name="elementType">html element to render widget with</param>
        /// <param name="renderType">how to render the widget</param>
        public Literal (string elementType, Widget.RenderingType renderType)
            : base (elementType, renderType)
        { }

        /// <summary>
        /// initializes a new instance of the <see cref="phosphorus.ajax.widgets.Literal"/> class
        /// </summary>
        /// <param name="elementType">html element to render widget with</param>
        /// <param name="renderType">how to render the widget</param>
        /// <param name="innerValue">content of literal</param>
        public Literal (string elementType, Widget.RenderingType renderType, string innerValue)
            : base (elementType, renderType)
        {
            this.innerValue = innerValue;
        }

        // overridden to supply default html element
        public override string ElementType {
            get {
                if (string.IsNullOrEmpty (base.ElementType))
                    return "p";
                return base.ElementType;
            }
            set {
                base.ElementType = value;
            }
        }

        /// <summary>
        /// gets or sets the innerValue property of the widget. this is also the inner default property of the widget, 
        /// which means the stuff between the opening and end declaration of the widget in your .aspx markup
        /// </summary>
        /// <value>the inner html</value>
        [PersistenceMode(PersistenceMode.InnerDefaultProperty)]
        public string innerValue {
            get { return this ["innerValue"]; }
            set { this ["innerValue"] = value; }
        }

        // notice how we do not call base here, and only render the innerValue and none of its children
        protected override void RenderChildren (HtmlTextWriter writer)
        {
            writer.Write (innerValue);
        }

        protected override void AddedControl (Control control, int index)
        {
            throw new ApplicationException ("Literal widget cannot have children controls");
        }
        
        protected override bool HasContent {
            get { return !string.IsNullOrEmpty (innerValue); }
        }
    }
}

