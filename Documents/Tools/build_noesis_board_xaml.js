/**
 * NoesisBoard 의 XAML 을 만든다.
 *
 *   node Documents/Tools/build_noesis_board_xaml.js
 *
 * 행 비율은 `PuzzleUI_RelativeLayout.ts` 의 상수에서 나온다 (위 6 · 아래 8 · 보드 7 : 보조 3,
 * 보드 정사각형은 가로 96% · 보드 영역 세로 94%). 그 상수를 바꾸면 여기도 같이 바꾸고 다시 돌린다.
 * 설계 좌표(보드 900, 미니 격자 300, 트레이 칸 100)는 `NoesisBoard_Panel.ts` 의 상수와 같아야 한다.
 */
const fs = require('fs');
const path = require('path');

const TOP_INSET = 6;
const BOTTOM_INSET = 8;
const BOARD_FLEX = 7;
const AUX_FLEX = 3;
const BOARD_WIDTH_PERCENT = 96;
const BOARD_HEIGHT_PERCENT = 94;

const BOARD_DESIGN_SIZE = 900;
const SIDE_DESIGN_SIZE = 300;
const TRAY_SLOT_SIZE = 100;
/** 조각 자리 수 - `PuzzleBoardUI_Definitions.PUZZLE_BOARD_MAX_PIECES` 와 같아야 한다 */
const PIECE_SLOTS = 20;

const usable = 100 - TOP_INSET - BOTTOM_INSET;
const boardRow = (usable * BOARD_FLEX / (BOARD_FLEX + AUX_FLEX)).toFixed(1);
const auxRow = (usable * AUX_FLEX / (BOARD_FLEX + AUX_FLEX)).toFixed(1);
const sideMargin = ((100 - BOARD_WIDTH_PERCENT) / 2).toFixed(1);
const topMargin = ((100 - BOARD_HEIGHT_PERCENT) / 2).toFixed(1);

const OUTPUT = path.join(__dirname, '..', 'NoesisSample', 'NoesisBoard', 'PuzzleBoard.xaml');

/** 터치는 Touch* 로도, 승격된 Mouse* 로도 올 수 있어 둘 다 건다. 중복은 스크립트가 거른다 */
function triggers(indent, pairs) {
	const lines = [`${indent}<b:Interaction.Triggers>`];
	for (const [eventName, command] of pairs) {
		lines.push(`${indent}\t<b:EventTrigger EventName="${eventName}">`);
		lines.push(`${indent}\t\t<b:InvokeCommandAction Command="{Binding ${command}}"/>`);
		lines.push(`${indent}\t</b:EventTrigger>`);
	}
	lines.push(`${indent}</b:Interaction.Triggers>`);
	return lines.join('\n');
}

/**
 * 루트의 포인터 이벤트를 **인자째** 스크립트에 넘긴다 (`PassEventArgsToCommand`, MoveLab 에서 확인).
 * 조각 계층이 쓴다 - Down 은 Preview(터널링)라 조각 밑 칸의 자기 Down 보다 먼저 온다.
 * 뗌은 여기 하나로 모인다 (조각을 놓든, 칸 누름을 끝내든 스크립트가 가른다).
 */
function pointerTriggers(indent) {
	const pairs = [
		['PreviewMouseLeftButtonDown', 'OnMouseDown'], ['MouseMove', 'OnMouseMove'], ['MouseLeftButtonUp', 'OnMouseUp'],
		['PreviewTouchDown', 'OnTouchDown'], ['TouchMove', 'OnTouchMove'], ['TouchUp', 'OnTouchUp'],
	];
	return pairs.map(([eventName, command]) => [
		`${indent}<b:EventTrigger EventName="${eventName}">`,
		`${indent}\t<b:InvokeCommandAction Command="{Binding ${command}}" PassEventArgsToCommand="True"/>`,
		`${indent}</b:EventTrigger>`,
	].join('\n')).join('\n');
}

/** 조각 자리 하나 - 낱개 키 P{n}… 에 묶인다. 입력을 받지 않는 그림이다 (루트가 좌표로 판정한다) */
function pieceSlot(n) {
	const p = `P${n}`;
	return [
		`\t\t\t\t\t<Grid Canvas.Left="{Binding ${p}X}" Canvas.Top="{Binding ${p}Y}" Width="{Binding ${p}W}" Height="{Binding ${p}H}"`,
		`\t\t\t\t\t\t  Visibility="{Binding ${p}Vis}" Opacity="{Binding ${p}Alpha}">`,
		`\t\t\t\t\t\t<Border CornerRadius="10" Background="{Binding ${p}Fill}"/>`,
		`\t\t\t\t\t\t<Image Source="{Binding ${p}Tex}" Stretch="UniformToFill"/>`,
		`\t\t\t\t\t\t<TextBlock Text="{Binding ${p}Label}" Foreground="{Binding ${p}LabelColor}" FontSize="{Binding ${p}Font}" FontWeight="Bold"`,
		'\t\t\t\t\t\t\t\t   HorizontalAlignment="Center" VerticalAlignment="Center"/>',
		`\t\t\t\t\t\t<Border CornerRadius="10" BorderBrush="{Binding ${p}Edge}" BorderThickness="{Binding ${p}EdgeWidth}"/>`,
		'\t\t\t\t\t</Grid>',
	].join('\n');
}

function pieceSlots(count) {
	const parts = [];
	for (let n = 1; n <= count; n++) {
		parts.push(pieceSlot(n));
	}
	return parts.join('\n');
}

function rootSize(indent) {
	return [
		`${indent}<b:InvokeCommandAction Command="{Binding OnRootWidth}" CommandParameter="{Binding ActualWidth, ElementName=Root}"/>`,
		`${indent}<b:InvokeCommandAction Command="{Binding OnRootHeight}" CommandParameter="{Binding ActualHeight, ElementName=Root}"/>`,
	].join('\n');
}

/** 칸·슬롯의 얼굴. 색 -> 그림 -> 글자 -> 부품 무늬 -> 강조 테두리 순으로 겹친다 */
function face(indent, options) {
	const lines = [
		`${indent}<Grid Margin="{Binding FaceMargin}" Opacity="{Binding Alpha}" IsHitTestVisible="False">`,
		`${indent}\t<Border CornerRadius="${options.radius}" Background="{Binding Fill}"/>`,
		`${indent}\t<Image Source="{Binding Tex}" Stretch="UniformToFill"/>`,
		`${indent}\t<TextBlock Text="{Binding Label}" Foreground="{Binding LabelColor}" FontSize="{Binding ${options.font}}" FontWeight="Bold"`,
		`${indent}\t\t\t   HorizontalAlignment="Center" VerticalAlignment="Center"/>`,
	];
	if (options.hasGlyph === true) {
		lines.push(`${indent}\t<Border CornerRadius="${options.radius}" BorderBrush="#FFFAEB8C" BorderThickness="{Binding Glyph}"/>`);
	}
	lines.push(`${indent}\t<Border CornerRadius="${options.radius}" BorderBrush="{Binding Edge}" BorderThickness="{Binding EdgeWidth}"/>`);
	lines.push(`${indent}</Grid>`);
	return lines.join('\n');
}

function itemsControl(indent, attributes, itemsSource, template, panel) {
	return [
		`${indent}<ItemsControl ${attributes} ItemsSource="{Binding ${itemsSource}}" ItemTemplate="{StaticResource ${template}}">`,
		`${indent}\t<ItemsControl.Template>`,
		`${indent}\t\t<ControlTemplate TargetType="ItemsControl">`,
		`${indent}\t\t\t<ItemsPresenter/>`,
		`${indent}\t\t</ControlTemplate>`,
		`${indent}\t</ItemsControl.Template>`,
		`${indent}\t<ItemsControl.ItemsPanel>`,
		`${indent}\t\t<ItemsPanelTemplate>`,
		`${indent}\t\t\t${panel}`,
		`${indent}\t\t</ItemsPanelTemplate>`,
		`${indent}\t</ItemsControl.ItemsPanel>`,
		`${indent}</ItemsControl>`,
	].join('\n');
}

const xaml = `<!--
  NoesisBoard - the puzzle board screen for all eight puzzles.  GENERATED: edit
  Documents/Tools/build_noesis_board_xaml.js and run it again, do not edit this file.

  Script: NoesisBoard_Panel.ts. Rows follow PuzzleBoardUI_Panel: top inset ${TOP_INSET}% /
  board ${BOARD_FLEX} : aux ${AUX_FLEX} / bottom inset ${BOTTOM_INSET}%. The board square is a Viewbox over a
  ${BOARD_DESIGN_SIZE} x ${BOARD_DESIGN_SIZE} design; cells flow into a WrapPanel in cell-index order and wrap at GridWidth.
-->
<Grid
	xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
	xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
	xmlns:b="http://schemas.microsoft.com/xaml/behaviors"
	x:Name="Root" Background="#FF14171F">

	<Grid.Resources>
		<Style x:Key="BarButton" TargetType="Button">
			<Setter Property="Foreground" Value="#FFFFFFFF"/>
			<Setter Property="FontWeight" Value="Bold"/>
			<Setter Property="Template">
				<Setter.Value>
					<ControlTemplate TargetType="Button">
						<Border x:Name="Bd" Background="{TemplateBinding Background}" CornerRadius="10">
							<ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
						</Border>
						<ControlTemplate.Triggers>
							<Trigger Property="IsPressed" Value="True">
								<Setter TargetName="Bd" Property="Opacity" Value="0.7"/>
							</Trigger>
						</ControlTemplate.Triggers>
					</ControlTemplate>
				</Setter.Value>
			</Setter>
		</Style>

		<!-- The cell's own box is the hit area (gap included, so neighbours touch); only the face inside scales. -->
		<DataTemplate x:Key="BoardCell">
			<Grid Width="{Binding Size}" Height="{Binding Size}" Background="Transparent">
${triggers('\t\t\t\t', [
	['MouseLeftButtonDown', 'OnDown'], ['TouchDown', 'OnDown'],
	['MouseEnter', 'OnEnter'], ['TouchEnter', 'OnEnter'],
	['MouseLeave', 'OnLeave'], ['TouchLeave', 'OnLeave'],
])}
${face('\t\t\t\t', { radius: 8, font: 'Font', hasGlyph: true })}
			</Grid>
		</DataTemplate>

		<DataTemplate x:Key="SideCell">
			<Grid Width="{Binding Size}" Height="{Binding Size}">
${face('\t\t\t\t', { radius: 6, font: 'Font', hasGlyph: false })}
			</Grid>
		</DataTemplate>

		<DataTemplate x:Key="TrayItem">
			<Grid Width="{Binding Size}" Height="{Binding Size}" Background="Transparent">
${triggers('\t\t\t\t', [['MouseLeftButtonDown', 'OnDown'], ['TouchDown', 'OnDown']])}
				<Grid Margin="{Binding FaceMargin}" Opacity="{Binding Alpha}" IsHitTestVisible="False">
					<Border CornerRadius="10" Background="{Binding Fill}"/>
					<Image Source="{Binding Tex}" Stretch="UniformToFill"/>
					<TextBlock Text="{Binding Label}" Foreground="{Binding LabelColor}" FontSize="40" FontWeight="Bold"
							   HorizontalAlignment="Center" VerticalAlignment="Center"/>
					<TextBlock Text="{Binding Caption}" Foreground="#FFFFFFFF" FontSize="18" FontWeight="Bold"
							   HorizontalAlignment="Right" VerticalAlignment="Bottom" Margin="0,0,6,2"/>
					<Border CornerRadius="10" BorderBrush="#FFFAEB8C" BorderThickness="{Binding Glyph}"/>
					<Border CornerRadius="10" BorderBrush="{Binding Edge}" BorderThickness="{Binding EdgeWidth}"/>
				</Grid>
			</Grid>
		</DataTemplate>
	</Grid.Resources>

	<!--
	  Every release ends here, wherever the finger is - the script's pointerUp() works only once per press.
	  A touch release can be raised on the element the touch STARTED on rather than the one under the
	  finger, so where the finger is at that moment is never read from this event; the script tracks
	  it from Enter / Leave instead.
	  The root size goes to the script for the bar font and the tray arrangement (Loaded can come
	  before the dataContext, so the first press sends it again). The re-send MUST sit on the touch
	  press as well as the mouse press: on mobile the mouse press never fires, so a mouse-only
	  re-send leaves the script with no root size, no board rect, and no way to turn pointer pixels
	  into grid coordinates - the grab then misses every piece.
	-->
	<b:Interaction.Triggers>
		<!--
		  Root size FIRST, pointer handlers after. Both blocks answer PreviewMouseLeftButtonDown /
		  PreviewTouchDown, and triggers run in document order - so putting the size ahead means the
		  script already knows the board rect when the press handler runs and can tell which piece was
		  grabbed. The other way round, the very first press on a device whose Loaded fired before the
		  dataContext is resolved against a board rect of zero and grabs nothing.
		-->
		<b:EventTrigger EventName="Loaded">
${rootSize('\t\t\t')}
		</b:EventTrigger>
		<b:EventTrigger EventName="SizeChanged">
${rootSize('\t\t\t')}
		</b:EventTrigger>
		<b:EventTrigger EventName="PreviewMouseLeftButtonDown">
${rootSize('\t\t\t')}
		</b:EventTrigger>
		<b:EventTrigger EventName="PreviewTouchDown">
${rootSize('\t\t\t')}
		</b:EventTrigger>
${pointerTriggers('\t\t')}
	</b:Interaction.Triggers>

	<Grid.RowDefinitions>
		<RowDefinition Height="${TOP_INSET}*"/>
		<RowDefinition Height="${boardRow}*"/>
		<RowDefinition Height="${auxRow}*"/>
		<RowDefinition Height="${BOTTOM_INSET}*"/>
	</Grid.RowDefinitions>

	<!-- Top inset: status bar / notch room, and the optional title. -->
	<TextBlock Grid.Row="0" Text="{Binding Title}" Visibility="{Binding TitleVis}" FontSize="{Binding BarFont}" FontWeight="Bold"
			   Foreground="#FFFFFFFF" HorizontalAlignment="Center" VerticalAlignment="Bottom"/>

	<!-- Board area: a square, ${BOARD_WIDTH_PERCENT}% of the width and ${BOARD_HEIGHT_PERCENT}% of this row at most. -->
	<Grid Grid.Row="1">
		<Grid.ColumnDefinitions>
			<ColumnDefinition Width="${sideMargin}*"/>
			<ColumnDefinition Width="${BOARD_WIDTH_PERCENT}*"/>
			<ColumnDefinition Width="${sideMargin}*"/>
		</Grid.ColumnDefinitions>
		<Grid.RowDefinitions>
			<RowDefinition Height="${topMargin}*"/>
			<RowDefinition Height="${BOARD_HEIGHT_PERCENT}*"/>
			<RowDefinition Height="${topMargin}*"/>
		</Grid.RowDefinitions>
		<Viewbox Grid.Row="1" Grid.Column="1" Stretch="Uniform">
			<Grid Width="${BOARD_DESIGN_SIZE}" Height="${BOARD_DESIGN_SIZE}">
				<Image Source="{Binding BoardTex}" Stretch="UniformToFill" IsHitTestVisible="False"/>
${itemsControl('\t\t\t\t', 'Width="{Binding GridWidth}" HorizontalAlignment="Center" VerticalAlignment="Center"', 'Cells', 'BoardCell', '<WrapPanel/>')}
				<!-- Piece layer: ${PIECE_SLOTS} slots placed by the script in the same 900 design space as the cells. -->
				<Canvas IsHitTestVisible="False">
${pieceSlots(PIECE_SLOTS)}
				</Canvas>
			</Grid>
		</Viewbox>
	</Grid>

	<!--
	  Aux area: tray or action button, side mini grid, Reset. Entering it with a piece in hand means
	  "left the board" - releasing here puts the piece back. (Not an Up trigger: a piece picked from
	  the tray would always release "here", because that is where its touch started.)
	-->
	<Grid Grid.Row="2" Background="Transparent">
${triggers('\t\t', [['MouseEnter', 'OnAuxEnter'], ['TouchEnter', 'OnAuxEnter']])}
		<Grid.ColumnDefinitions>
			<ColumnDefinition Width="3*"/>
			<ColumnDefinition Width="94*"/>
			<ColumnDefinition Width="3*"/>
		</Grid.ColumnDefinitions>
		<Grid.RowDefinitions>
			<RowDefinition Height="8*"/>
			<RowDefinition Height="84*"/>
			<RowDefinition Height="8*"/>
		</Grid.RowDefinitions>

		<Border Grid.Row="1" Grid.Column="1" Background="#FF1C1F2B" CornerRadius="14" Visibility="{Binding AuxVis}">
			<Grid>
				<Grid.ColumnDefinitions>
					<ColumnDefinition Width="3*"/>
					<ColumnDefinition Width="52*"/>
					<ColumnDefinition Width="2*"/>
					<ColumnDefinition Width="20*"/>
					<ColumnDefinition Width="2*"/>
					<ColumnDefinition Width="18*"/>
					<ColumnDefinition Width="3*"/>
				</Grid.ColumnDefinitions>
				<Grid.RowDefinitions>
					<RowDefinition Height="12*"/>
					<RowDefinition Height="76*"/>
					<RowDefinition Height="12*"/>
				</Grid.RowDefinitions>

				<!--
				  Tray: slots are ${TRAY_SLOT_SIZE} square and wrap at TrayWidth, so the script picks rows x columns
				  (up to 3 rows, whichever gives the biggest slot) and the Viewbox fits the result.
				  Two hosts: the wide one also takes the side grid's columns when there is no side grid.
				-->
				<Viewbox Grid.Row="1" Grid.Column="1" Stretch="Uniform" Visibility="{Binding TrayVis}">
${itemsControl('\t\t\t\t\t', 'Width="{Binding TrayWidth}"', 'Items', 'TrayItem', '<WrapPanel/>')}
				</Viewbox>
				<Viewbox Grid.Row="1" Grid.Column="1" Grid.ColumnSpan="3" Stretch="Uniform" Visibility="{Binding TrayWideVis}">
${itemsControl('\t\t\t\t\t', 'Width="{Binding TrayWidth}"', 'Items', 'TrayItem', '<WrapPanel/>')}
				</Viewbox>

				<!-- Action button (colour fill's STOP): fires on press, not on release. -->
				<Button Grid.Row="1" Grid.Column="1" Style="{StaticResource BarButton}" Background="#FFE11D48" ClickMode="Press"
						Visibility="{Binding ActionVis}" Content="{Binding ActionLabel}" FontSize="{Binding BarFont}" Command="{Binding OnAction}"/>

				<Grid Grid.Row="1" Grid.Column="3" Visibility="{Binding SideVis}">
					<Grid.RowDefinitions>
						<RowDefinition Height="18*"/>
						<RowDefinition Height="82*"/>
					</Grid.RowDefinitions>
					<Viewbox Grid.Row="0" Stretch="Uniform">
						<TextBlock Text="{Binding SideLabel}" Foreground="#FF94A3B8" FontSize="20"/>
					</Viewbox>
					<Viewbox Grid.Row="1" Stretch="Uniform">
						<Grid Width="${SIDE_DESIGN_SIZE}" Height="${SIDE_DESIGN_SIZE}" IsHitTestVisible="False">
${itemsControl('\t\t\t\t\t\t\t', 'Width="{Binding SideWidth}" HorizontalAlignment="Center" VerticalAlignment="Center"', 'SideCells', 'SideCell', '<WrapPanel/>')}
						</Grid>
					</Viewbox>
				</Grid>

				<Button Grid.Row="1" Grid.Column="5" Style="{StaticResource BarButton}" Background="#FF52576B"
						Content="Reset" FontSize="{Binding BarFont}" Command="{Binding OnReset}"/>
			</Grid>
		</Border>

		<!-- Level start banner: takes the aux area's place while it shows. -->
		<Border Grid.Row="1" Grid.Column="1" Background="#FF1C1F2B" CornerRadius="14" IsHitTestVisible="False"
				Visibility="{Binding IntroVis}" Opacity="{Binding IntroAlpha}">
			<Viewbox Stretch="Uniform" Margin="20">
				<TextBlock Text="{Binding IntroText}" Foreground="#FFF2CC40" FontSize="40" FontWeight="Bold"/>
			</Viewbox>
		</Border>
	</Grid>

	<!-- Bottom inset: Menu (pause). The hub's own bar is covered while the board is up. -->
	<Grid Grid.Row="3">
		<Grid.ColumnDefinitions>
			<ColumnDefinition Width="75*"/>
			<ColumnDefinition Width="22*"/>
			<ColumnDefinition Width="3*"/>
		</Grid.ColumnDefinitions>
		<Grid.RowDefinitions>
			<RowDefinition Height="14*"/>
			<RowDefinition Height="72*"/>
			<RowDefinition Height="14*"/>
		</Grid.RowDefinitions>
		<Button Grid.Row="1" Grid.Column="1" Style="{StaticResource BarButton}" Background="#FF3D455C" Opacity="0.92"
				Content="Menu" FontSize="{Binding BarFont}" Command="{Binding OnMenu}"/>
	</Grid>
</Grid>
`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, xaml, 'utf8');
console.log(`wrote ${OUTPUT}`);
